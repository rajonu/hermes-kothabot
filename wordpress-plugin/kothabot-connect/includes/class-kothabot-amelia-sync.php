<?php
/**
 * Two-way booking sync with the Amelia booking plugin.
 *
 *   Amelia  → KothaBot : on a new Amelia booking, POST /api/v1/appointments.
 *   KothaBot → Amelia  : on a voice/chat appointment webhook, create an Amelia
 *                        booking (best-effort via Amelia's REST API).
 *
 * Amelia's internal data shapes vary by version, so the outbound creation is
 * deliberately defensive and exposes the `kothabot_create_amelia_booking`
 * filter so a site can plug in its own creator if the default doesn't fit.
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Amelia_Sync {

	/** @var KothaBot_Client */
	private $client;

	/** @var array */
	private $settings;

	public function __construct( KothaBot_Client $client, array $settings ) {
		$this->client   = $client;
		$this->settings = $settings;

		// Amelia → KothaBot. Amelia fires this action after a booking is added.
		add_action( 'amelia_after_booking_added', array( $this, 'on_amelia_booking' ), 20, 1 );

		// KothaBot → Amelia (fired by the webhook receiver).
		add_action( 'kothabot_appointment_created', array( $this, 'on_kothabot_appointment' ), 10, 2 );
	}

	/**
	 * Push a new Amelia booking into KothaBot as an appointment.
	 *
	 * @param array $booking Amelia booking payload (shape varies by version).
	 */
	public function on_amelia_booking( $booking ) {
		if ( ! is_array( $booking ) ) {
			return;
		}
		// Loop guard: skip bookings that KothaBot itself created.
		if ( ! empty( $booking['kothabot_origin'] ) ) {
			return;
		}

		$customer = $booking['customer'] ?? $booking['bookings'][0]['customer'] ?? array();
		$name     = trim( ( $customer['firstName'] ?? '' ) . ' ' . ( $customer['lastName'] ?? '' ) );
		$phone    = $customer['phone'] ?? '';

		$payload = array(
			'status'   => 'pending',
			'notes'    => sprintf( 'Amelia booking — %s %s', $name, $phone ),
			'metadata' => array(
				'source'       => 'amelia',
				'amelia_id'    => $booking['id'] ?? null,
				'service_name' => $booking['service']['name'] ?? ( $booking['serviceName'] ?? null ),
				'booking_at'   => $booking['bookingStart'] ?? ( $booking['bookingStartString'] ?? null ),
				'provider'     => $booking['provider']['firstName'] ?? null,
				'customer_name' => $name,
				'customer_phone' => $phone,
			),
		);

		$res = $this->client->request( 'POST', '/api/v1/appointments', $payload );
		if ( ! $res['ok'] && defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[KothaBot] amelia->kothabot failed: ' . $res['error'] );
		}
	}

	/**
	 * Create an Amelia booking from a KothaBot voice/chat appointment.
	 *
	 * @param array $data     KothaBot appointment payload.
	 * @param array $settings Plugin settings.
	 */
	public function on_kothabot_appointment( $data, $settings ) {
		$meta = $data['metadata'] ?? array();

		// Loop guard: this appointment came from Amelia originally.
		if ( ! empty( $meta['amelia_id'] ) || ( isset( $meta['source'] ) && 'amelia' === $meta['source'] ) ) {
			return;
		}

		/**
		 * Let a site fully own Amelia booking creation. Return true if handled.
		 *
		 * @param bool  $handled
		 * @param array $data     KothaBot appointment data.
		 */
		$handled = apply_filters( 'kothabot_create_amelia_booking', false, $data );
		if ( $handled ) {
			return;
		}

		// Default best-effort: call Amelia's REST API if available. Amelia must
		// be active and its API reachable; mapping service/provider IDs is
		// site-specific, so we only attempt when those are provided in metadata.
		if ( empty( $meta['amelia_service_id'] ) || empty( $meta['amelia_provider_id'] ) ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( '[KothaBot] appointment received but no Amelia service/provider mapping — skipping auto-create. Use the kothabot_create_amelia_booking filter to handle it.' );
			}
			return;
		}

		// Amelia REST booking creation (admin-ajax bridge).
		$endpoint = admin_url( 'admin-ajax.php?action=wpamelia_api&call=/api/v1/bookings' );
		$body     = array(
			'type'         => 'appointment',
			'serviceId'    => (int) $meta['amelia_service_id'],
			'providerId'   => (int) $meta['amelia_provider_id'],
			'bookingStart' => $meta['booking_at'] ?? '',
			'bookings'     => array(
				array(
					'customer' => array(
						'firstName' => $meta['customer_name'] ?? 'Customer',
						'phone'     => $meta['customer_phone'] ?? '',
					),
				),
			),
			'kothabot_origin' => $data['id'] ?? '',
		);

		$res = wp_remote_post(
			$endpoint,
			array(
				'timeout' => 20,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $res ) && defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[KothaBot] kothabot->amelia failed: ' . $res->get_error_message() );
		}
	}
}
