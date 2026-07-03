<?php
/**
 * Embeds the KothaBot voice/chat widget on the site front end.
 *
 * Reuses the existing embed.js loader served from the KothaBot domain — the
 * same script the dashboard generates — configured via data-* attributes.
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Widget {

	/** @var array */
	private $settings;

	public function __construct( array $settings ) {
		$this->settings = $settings;
		add_action( 'wp_footer', array( $this, 'render' ) );
	}

	public function render() {
		$base    = untrailingslashit( $this->settings['api_base'] );
		$shop_id = $this->settings['shop_id'];
		if ( empty( $base ) || empty( $shop_id ) ) {
			return;
		}

		printf(
			'<script src="%s/embed.js" data-shop="%s" data-color="%s" data-position="%s" data-lang="%s" data-voice="%s" data-chat="%s" async></script>' . "\n",
			esc_url( $base ),
			esc_attr( $shop_id ),
			esc_attr( $this->settings['widget_color'] ),
			esc_attr( $this->settings['widget_position'] ),
			esc_attr( $this->settings['widget_lang'] ),
			! empty( $this->settings['enable_voice'] ) ? '1' : '0',
			! empty( $this->settings['enable_chat'] ) ? '1' : '0'
		);
	}
}
