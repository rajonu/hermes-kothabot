<?php
/**
 * Syncs new WooCommerce orders → KothaBot orders (one direction).
 *
 * The KothaBot order id is stored on the WC order, and metadata.wc_order_id is
 * sent so the inbound webhook receiver (Phase 2) can skip re-creating an order
 * that originated here (loop prevention).
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Order_Sync {

	const META_ID     = '_kothabot_order_id';
	const META_SYNCED = '_kothabot_synced';

	/** @var KothaBot_Client */
	private $client;

	public function __construct( KothaBot_Client $client ) {
		$this->client = $client;
		// Fires once when a checkout order is created.
		add_action( 'woocommerce_checkout_order_processed', array( $this, 'on_new_order' ), 20, 1 );
		// Covers admin-created / API orders too.
		add_action( 'woocommerce_new_order', array( $this, 'on_new_order' ), 20, 1 );
	}

	/**
	 * @param int $order_id
	 */
	public function on_new_order( $order_id ) {
		if ( ! function_exists( 'wc_get_order' ) ) {
			return;
		}
		// Idempotency: never sync the same WC order twice, and never sync an
		// order that KothaBot itself created via the webhook receiver.
		if ( get_post_meta( $order_id, self::META_SYNCED, true ) || get_post_meta( $order_id, '_kothabot_origin', true ) ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$items = array();
		foreach ( $order->get_items() as $item ) {
			$items[] = array(
				'name'       => $item->get_name(),
				'quantity'   => (int) $item->get_quantity(),
				'unit_price' => (float) $order->get_item_total( $item, false ),
			);
		}

		$payload = array(
			'type'         => 'order',
			'status'       => 'pending',
			'items'        => $items,
			'total_amount' => (float) $order->get_total(),
			'notes'        => sprintf(
				'WooCommerce #%s | %s %s | %s',
				$order->get_order_number(),
				$order->get_billing_first_name(),
				$order->get_billing_last_name(),
				$order->get_billing_phone()
			),
			'metadata'     => array(
				'wc_order_id' => $order_id,
				'source'      => 'woocommerce',
				'email'       => $order->get_billing_email(),
				'phone'       => $order->get_billing_phone(),
			),
		);

		$res = $this->client->create_order( $payload );
		if ( $res['ok'] && ! empty( $res['data']['data']['id'] ) ) {
			update_post_meta( $order_id, self::META_ID, $res['data']['data']['id'] );
			update_post_meta( $order_id, self::META_SYNCED, 1 );
		} elseif ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[KothaBot] order sync failed #' . $order_id . ': ' . $res['error'] );
		}
	}
}
