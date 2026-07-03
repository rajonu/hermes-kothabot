<?php
/**
 * Plugin Name:       KothaBot Connect
 * Plugin URI:        https://kothabot.ai.bd
 * Description:        Connects your WordPress site to your KothaBot Voice AI assistant — embeds the voice/chat widget, syncs WooCommerce products & page knowledge into the AI, and keeps orders and bookings in two-way sync.
 * Version:           1.2.1
 * Author:            KothaBot
 * Author URI:        https://kothabot.ai.bd
 * License:           GPL-2.0-or-later
 * Text Domain:       kothabot-connect
 * Requires at least: 6.0
 * Requires PHP:      7.4
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'KOTHABOT_CONNECT_VERSION', '1.2.1' );
define( 'KOTHABOT_CONNECT_FILE', __FILE__ );
define( 'KOTHABOT_CONNECT_DIR', plugin_dir_path( __FILE__ ) );
define( 'KOTHABOT_CONNECT_URL', plugin_dir_url( __FILE__ ) );
define( 'KOTHABOT_CONNECT_OPTION', 'kothabot_connect_settings' );

require_once KOTHABOT_CONNECT_DIR . 'includes/class-kothabot-client.php';
require_once KOTHABOT_CONNECT_DIR . 'includes/class-kothabot-product-sync.php';
require_once KOTHABOT_CONNECT_DIR . 'includes/class-kothabot-order-sync.php';
require_once KOTHABOT_CONNECT_DIR . 'includes/class-kothabot-knowledge-sync.php';
require_once KOTHABOT_CONNECT_DIR . 'includes/class-kothabot-widget.php';
require_once KOTHABOT_CONNECT_DIR . 'includes/class-kothabot-webhook-receiver.php';
require_once KOTHABOT_CONNECT_DIR . 'includes/class-kothabot-amelia-sync.php';
require_once KOTHABOT_CONNECT_DIR . 'admin/class-kothabot-settings.php';
require_once KOTHABOT_CONNECT_DIR . 'admin/class-kothabot-appointments.php';

/**
 * Read the plugin settings (with defaults).
 *
 * @return array
 */
function kothabot_connect_settings() {
	$defaults = array(
		'api_base'         => 'https://my.kothabot.ai.bd',
		'api_key'          => '',
		'shop_id'          => '',
		'sync_products'    => 0,
		'sync_orders'      => 0,
		'sync_knowledge'   => 0,
		'embed_widget'     => 0,
		'widget_color'     => '#10b981',
		'widget_position'  => 'right',
		'widget_lang'      => 'auto',
		'enable_voice'     => 1,
		'enable_chat'      => 1,
		'knowledge_pages'  => array(),
		'webhook_secret'   => '',
	);
	$saved = get_option( KOTHABOT_CONNECT_OPTION, array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
}

/**
 * Boot the plugin once all plugins are loaded (so WooCommerce is detectable).
 */
function kothabot_connect_init() {
	$settings = kothabot_connect_settings();
	$client   = new KothaBot_Client( $settings );

	// Admin settings UI.
	if ( is_admin() ) {
		new KothaBot_Settings( $client );
		// Appointments manager (always available if key is configured — clinic shops only see it).
		if ( $client->has_credentials() ) {
			new KothaBot_Appointments( $client, $settings );
		}
	}

	$has_woo = class_exists( 'WooCommerce' );

	if ( $has_woo && ! empty( $settings['sync_products'] ) ) {
		new KothaBot_Product_Sync( $client );
	}
	if ( $has_woo && ! empty( $settings['sync_orders'] ) ) {
		new KothaBot_Order_Sync( $client );
	}
	if ( ! empty( $settings['sync_knowledge'] ) ) {
		new KothaBot_Knowledge_Sync( $client );
	}
	if ( ! empty( $settings['embed_widget'] ) && ! empty( $settings['shop_id'] ) ) {
		new KothaBot_Widget( $settings );
	}

	// Inbound webhooks (voice/chat order & appointment → WC/Amelia).
	if ( ! empty( $settings['webhook_secret'] ) ) {
		new KothaBot_Webhook_Receiver( $settings );
	}

	// Amelia two-way booking sync (only when Amelia is active).
	if ( defined( 'AMELIA_VERSION' ) || class_exists( 'AmeliaBooking\\Plugin' ) ) {
		new KothaBot_Amelia_Sync( $client, $settings );
	}
}
add_action( 'plugins_loaded', 'kothabot_connect_init' );

/**
 * On activation, store defaults if no settings exist yet.
 */
function kothabot_connect_activate() {
	if ( false === get_option( KOTHABOT_CONNECT_OPTION ) ) {
		add_option( KOTHABOT_CONNECT_OPTION, array() );
	}
}
register_activation_hook( __FILE__, 'kothabot_connect_activate' );
