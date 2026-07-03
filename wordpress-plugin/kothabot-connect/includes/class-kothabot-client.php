<?php
/**
 * Thin HTTP client for the KothaBot Public API v1.
 *
 * Server-to-server only (uses the secret API key), so no CORS concerns.
 * All requests send `Authorization: Bearer kb_live_…` and back off on 429.
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Client {

	/** @var string */
	private $base;

	/** @var string */
	private $key;

	/** @var string */
	private $shop_id;

	public function __construct( array $settings ) {
		$this->base    = untrailingslashit( $settings['api_base'] ?? '' );
		$this->key     = $settings['api_key'] ?? '';
		$this->shop_id = $settings['shop_id'] ?? '';
	}

	public function has_credentials() {
		return ! empty( $this->base ) && ! empty( $this->key );
	}

	public function get_shop_id() {
		return $this->shop_id;
	}

	/**
	 * Perform a request against the v1 API.
	 *
	 * @param string     $method  GET|POST|PUT|DELETE.
	 * @param string     $path    e.g. "/api/v1/products".
	 * @param array|null $body    JSON body (for write methods).
	 * @return array { ok: bool, status: int, data: array, error: string }
	 */
	public function request( $method, $path, $body = null ) {
		if ( ! $this->has_credentials() ) {
			return array( 'ok' => false, 'status' => 0, 'data' => array(), 'error' => 'KothaBot API not configured' );
		}

		$args = array(
			'method'  => $method,
			'timeout' => 20,
			'headers' => array(
				'Authorization' => 'Bearer ' . $this->key,
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			),
		);
		if ( null !== $body ) {
			$args['body'] = wp_json_encode( $body );
		}

		$url = $this->base . $path;

		// Up to 3 attempts, honouring Retry-After on 429.
		$attempts = 0;
		do {
			$attempts++;
			$res = wp_remote_request( $url, $args );

			if ( is_wp_error( $res ) ) {
				return array( 'ok' => false, 'status' => 0, 'data' => array(), 'error' => $res->get_error_message() );
			}

			$status = (int) wp_remote_retrieve_response_code( $res );

			if ( 429 === $status && $attempts < 3 ) {
				$retry = (int) wp_remote_retrieve_header( $res, 'retry-after' );
				sleep( max( 1, min( 30, $retry ) ) );
				continue;
			}
			break;
		} while ( $attempts < 3 );

		$raw  = wp_remote_retrieve_body( $res );
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			$data = array();
		}

		$ok = $status >= 200 && $status < 300;
		// The v1 API responds with the payload's own top-level keys (data, meta, etc.) —
		// merge them up so callers can read $res['data'] / $res['meta'] directly instead
		// of getting the whole response body nested one level too deep under 'data'.
		return array_merge(
			array(
				'ok'     => $ok,
				'status' => $status,
				'data'   => array(),
				'error'  => $ok ? '' : ( $data['error'] ?? ( 'HTTP ' . $status ) ),
			),
			$data
		);
	}

	/**
	 * Validate the key and resolve the shop id via GET /api/v1/me.
	 *
	 * @return array { ok, shop_id, shop_name, error }
	 */
	public function fetch_me() {
		$res = $this->request( 'GET', '/api/v1/me' );
		if ( ! $res['ok'] ) {
			return array( 'ok' => false, 'shop_id' => '', 'shop_name' => '', 'error' => $res['error'] );
		}
		$shop = $res['data']['shop'] ?? array();
		return array(
			'ok'        => true,
			'shop_id'   => $shop['id'] ?? '',
			'shop_name' => $shop['name'] ?? '',
			'error'     => '',
		);
	}

	// ── Convenience wrappers ────────────────────────────────────────────────

	public function upsert_product( array $product ) {
		return $this->request( 'POST', '/api/v1/products', $product );
	}

	public function bulk_upsert_products( array $products ) {
		return $this->request( 'POST', '/api/v1/products', array( 'products' => array_values( $products ) ) );
	}

	public function delete_product( $kothabot_id ) {
		return $this->request( 'DELETE', '/api/v1/products/' . rawurlencode( $kothabot_id ) );
	}

	public function create_order( array $order ) {
		return $this->request( 'POST', '/api/v1/orders', $order );
	}

	public function put_knowledge( $content, $title = null ) {
		return $this->request( 'PUT', '/api/v1/knowledge', array( 'content' => $content, 'title' => $title ) );
	}

	public function register_webhook( $url, array $events ) {
		return $this->request( 'POST', '/api/v1/webhooks', array( 'url' => $url, 'events' => $events ) );
	}
}
