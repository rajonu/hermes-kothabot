<?php
/**
 * Receives signed webhooks from KothaBot and fans them out into WordPress.
 *
 *   order.created       → create a WooCommerce order
 *   appointment.created → create an Amelia booking (via KothaBot_Amelia_Sync)
 *
 * Signature: KothaBot sends X-KothaBot-Signature: sha256=<hmac> where the HMAC
 * is over the raw JSON body with the webhook secret returned at registration.
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Webhook_Receiver {

	const ROUTE_NS   = 'kothabot/v1';
	const ROUTE_PATH = '/webhook';

	/** @var array */
	private $settings;

	public function __construct( array $settings ) {
		$this->settings = $settings;
		add_action( 'rest_api_init', array( $this, 'register_route' ) );
	}

	public static function endpoint_url() {
		return rest_url( self::ROUTE_NS . self::ROUTE_PATH );
	}

	public function register_route() {
		register_rest_route(
			self::ROUTE_NS,
			self::ROUTE_PATH,
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle' ),
				'permission_callback' => '__return_true', // auth is the HMAC signature.
			)
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function handle( $request ) {
		$secret = $this->settings['webhook_secret'] ?? '';
		$body   = $request->get_body();

		if ( empty( $secret ) ) {
			return new WP_REST_Response( array( 'error' => 'Webhook not configured' ), 503 );
		}

		// Verify signature.
		$header   = $request->get_header( 'x-kothabot-signature' );
		$provided = preg_replace( '/^sha256=/', '', (string) $header );
		$expected = hash_hmac( 'sha256', $body, $secret );
		if ( empty( $provided ) || ! hash_equals( $expected, $provided ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid signature' ), 401 );
		}

		$payload = json_decode( $body, true );
		if ( ! is_array( $payload ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid JSON' ), 400 );
		}

		$event = $payload['event'] ?? '';
		$data  = $payload['data'] ?? array();

		switch ( $event ) {
			case 'order.created':
				$this->handle_order_created( $data );
				break;
			case 'appointment.created':
				do_action( 'kothabot_appointment_created', $data, $this->settings );
				break;
		}

		// Always 200 on a valid signature so KothaBot doesn't retry forever.
		return new WP_REST_Response( array( 'received' => true ), 200 );
	}

	/**
	 * Create a WooCommerce order from a KothaBot order — unless it originated
	 * from WooCommerce (loop guard via metadata.wc_order_id).
	 *
	 * @param array $data
	 */
	private function handle_order_created( $data ) {
		if ( ! function_exists( 'wc_create_order' ) ) {
			return;
		}
		$meta = $data['metadata'] ?? array();

		// Loop guard: this order came from WooCommerce in the first place.
		if ( ! empty( $meta['wc_order_id'] ) || ( isset( $meta['source'] ) && 'woocommerce' === $meta['source'] ) ) {
			return;
		}

		// Idempotency: don't create twice for the same KothaBot order id.
		$kothabot_id = $data['id'] ?? '';
		if ( $kothabot_id ) {
			$existing = wc_get_orders( array( 'meta_key' => '_kothabot_origin', 'meta_value' => $kothabot_id, 'limit' => 1, 'return' => 'ids' ) );
			if ( ! empty( $existing ) ) {
				return;
			}
		}

		$order = wc_create_order();
		$items = is_array( $data['items'] ?? null ) ? $data['items'] : array();
		foreach ( $items as $item ) {
			$name  = $item['name'] ?? 'Item';
			$qty   = max( 1, (int) ( $item['quantity'] ?? 1 ) );
			$price = (float) ( $item['unit_price'] ?? 0 );

			// Match an existing WC product by name; else add a custom line item.
			$product_id = wc_get_product_id_by_sku( $item['sku'] ?? '' );
			if ( $product_id ) {
				$order->add_product( wc_get_product( $product_id ), $qty );
			} else {
				$line = new WC_Order_Item_Product();
				$line->set_name( $name );
				$line->set_quantity( $qty );
				$line->set_total( $price * $qty );
				$order->add_item( $line );
			}
		}

		$order->update_meta_data( '_kothabot_origin', $kothabot_id );
		$order->update_meta_data( '_kothabot_synced', 1 ); // prevent the outbound sync from echoing it back.
		$order->add_order_note( __( 'Created by KothaBot Voice AI assistant.', 'kothabot-connect' ) );
		$order->calculate_totals();
		$order->set_status( 'pending' );
		$order->save();
	}
}
