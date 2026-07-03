<?php
/**
 * Syncs WooCommerce products → KothaBot products (upsert by SKU).
 *
 * Real-time on save/delete, plus a batched full sync via WP-Cron so the
 * initial catalog import never blocks the store.
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Product_Sync {

	const META_ID    = '_kothabot_product_id';
	const CRON_HOOK  = 'kothabot_connect_product_batch';
	const BATCH_SIZE = 50;

	/** @var KothaBot_Client */
	private $client;

	public function __construct( KothaBot_Client $client ) {
		$this->client = $client;

		add_action( 'woocommerce_update_product', array( $this, 'on_save' ), 20, 1 );
		add_action( 'woocommerce_new_product', array( $this, 'on_save' ), 20, 1 );
		add_action( 'before_delete_post', array( $this, 'on_delete' ), 10, 1 );

		add_action( self::CRON_HOOK, array( $this, 'run_batch' ), 10, 1 );
	}

	/**
	 * Map a WC_Product to the KothaBot product payload.
	 *
	 * @param WC_Product $product
	 * @return array
	 */
	public function map_product( $product ) {
		$cats = wp_get_post_terms( $product->get_id(), 'product_cat', array( 'fields' => 'names' ) );
		$category = ( ! is_wp_error( $cats ) && ! empty( $cats ) ) ? $cats[0] : null;

		// SKU is the upsert key. Fall back to a stable synthetic SKU so products
		// without a WC SKU still update in place instead of duplicating.
		$sku = $product->get_sku();
		if ( empty( $sku ) ) {
			$sku = 'wc-' . $product->get_id();
		}

		$stock = $product->get_manage_stock() ? (int) $product->get_stock_quantity() : null;

		return array(
			'name'         => $product->get_name(),
			'description'  => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
			'price'        => $product->get_price() !== '' ? (float) $product->get_price() : null,
			'sku'          => $sku,
			'category'     => $category,
			'stock_qty'    => $stock,
			'is_available' => $product->is_purchasable() && $product->is_in_stock(),
			'metadata'     => array(
				'wc_product_id' => $product->get_id(),
				'permalink'     => get_permalink( $product->get_id() ),
				'type'          => $product->get_type(),
			),
		);
	}

	/**
	 * Push one product on save.
	 *
	 * @param int $product_id
	 */
	public function on_save( $product_id ) {
		if ( wp_is_post_revision( $product_id ) || ! function_exists( 'wc_get_product' ) ) {
			return;
		}
		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return;
		}

		$res = $this->client->upsert_product( $this->map_product( $product ) );
		if ( $res['ok'] && ! empty( $res['data']['data']['id'] ) ) {
			update_post_meta( $product_id, self::META_ID, $res['data']['data']['id'] );
		} else {
			$this->log( 'product upsert failed #' . $product_id . ': ' . $res['error'] );
		}
	}

	/**
	 * Delete from KothaBot when a WC product is deleted.
	 *
	 * @param int $post_id
	 */
	public function on_delete( $post_id ) {
		if ( get_post_type( $post_id ) !== 'product' ) {
			return;
		}
		$kothabot_id = get_post_meta( $post_id, self::META_ID, true );
		if ( $kothabot_id ) {
			$this->client->delete_product( $kothabot_id );
		}
	}

	/**
	 * Schedule a full catalog sync in batches (called from the settings "Sync now" button).
	 */
	public function schedule_full_sync() {
		wp_schedule_single_event( time() + 5, self::CRON_HOOK, array( 0 ) );
	}

	/**
	 * Process one batch and chain the next.
	 *
	 * @param int $offset
	 */
	public function run_batch( $offset ) {
		$offset = (int) $offset;
		$query  = new WP_Query(
			array(
				'post_type'      => 'product',
				'post_status'    => 'publish',
				'posts_per_page' => self::BATCH_SIZE,
				'offset'         => $offset,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);

		if ( empty( $query->posts ) ) {
			return; // done.
		}

		$payload = array();
		$ids     = array();
		foreach ( $query->posts as $pid ) {
			$product = wc_get_product( $pid );
			if ( $product ) {
				$payload[]   = $this->map_product( $product );
				$ids[ $product->get_sku() ?: ( 'wc-' . $pid ) ] = $pid;
			}
		}

		if ( $payload ) {
			$res = $this->client->bulk_upsert_products( $payload );
			if ( ! $res['ok'] ) {
				$this->log( 'bulk sync batch @' . $offset . ' failed: ' . $res['error'] );
			}
		}

		// Chain next batch.
		if ( count( $query->posts ) === self::BATCH_SIZE ) {
			wp_schedule_single_event( time() + 10, self::CRON_HOOK, array( $offset + self::BATCH_SIZE ) );
		}
	}

	private function log( $msg ) {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[KothaBot] ' . $msg );
		}
	}
}
