<?php
/**
 * Admin settings page for KothaBot Connect.
 *
 * One page under Settings → KothaBot: API credentials (validated via /me),
 * sync toggles, widget appearance, knowledge page picker, and "Sync now"
 * buttons. All writes are nonce-protected and sanitised.
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Settings {

	const NONCE  = 'kothabot_connect_save';
	const NOTICE = 'kothabot_connect_notice';

	/** @var KothaBot_Client */
	private $client;

	public function __construct( KothaBot_Client $client ) {
		$this->client = $client;
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_init', array( $this, 'maybe_handle_post' ) );
		add_action( 'admin_notices', array( $this, 'maybe_show_notice' ) );
	}

	public function add_menu() {
		add_options_page(
			__( 'KothaBot Connect', 'kothabot-connect' ),
			__( 'KothaBot', 'kothabot-connect' ),
			'manage_options',
			'kothabot-connect',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Handle the settings form submit + sync actions.
	 */
	public function maybe_handle_post() {
		if ( ! isset( $_POST['kothabot_action'] ) ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		check_admin_referer( self::NONCE );

		$action   = sanitize_text_field( wp_unslash( $_POST['kothabot_action'] ) );
		$settings = kothabot_connect_settings();

		if ( 'save' === $action ) {
			$settings['api_base']        = isset( $_POST['api_base'] ) ? esc_url_raw( wp_unslash( $_POST['api_base'] ) ) : $settings['api_base'];
			$settings['api_key']         = isset( $_POST['api_key'] ) ? sanitize_text_field( wp_unslash( $_POST['api_key'] ) ) : $settings['api_key'];
			$settings['sync_products']   = empty( $_POST['sync_products'] ) ? 0 : 1;
			$settings['sync_orders']     = empty( $_POST['sync_orders'] ) ? 0 : 1;
			$settings['sync_knowledge']  = empty( $_POST['sync_knowledge'] ) ? 0 : 1;
			$settings['embed_widget']    = empty( $_POST['embed_widget'] ) ? 0 : 1;
			$settings['widget_color']    = isset( $_POST['widget_color'] ) ? sanitize_hex_color( wp_unslash( $_POST['widget_color'] ) ) : $settings['widget_color'];
			$settings['widget_position'] = ( isset( $_POST['widget_position'] ) && 'left' === $_POST['widget_position'] ) ? 'left' : 'right';
			$settings['widget_lang']     = isset( $_POST['widget_lang'] ) ? sanitize_text_field( wp_unslash( $_POST['widget_lang'] ) ) : 'auto';
			$settings['enable_voice']    = empty( $_POST['enable_voice'] ) ? 0 : 1;
			$settings['enable_chat']     = empty( $_POST['enable_chat'] ) ? 0 : 1;
			$settings['knowledge_pages'] = isset( $_POST['knowledge_pages'] ) ? array_map( 'absint', (array) wp_unslash( $_POST['knowledge_pages'] ) ) : array();

			// Validate the key + resolve shop id.
			$client = new KothaBot_Client( $settings );
			$me     = $client->fetch_me();
			if ( $me['ok'] ) {
				$settings['shop_id'] = $me['shop_id'];

				// Register our webhook receiver so voice/chat orders & bookings
				// flow back into WooCommerce/Amelia. Store the returned secret.
				if ( empty( $settings['webhook_secret'] ) ) {
					$hook = $client->register_webhook(
						KothaBot_Webhook_Receiver::endpoint_url(),
						array( 'order.created', 'appointment.created' )
					);
					if ( $hook['ok'] && ! empty( $hook['data']['data']['secret'] ) ) {
						$settings['webhook_secret'] = $hook['data']['data']['secret'];
					}
				}

				$this->notice( 'success', sprintf( /* translators: %s shop name */ __( 'Connected to KothaBot: %s', 'kothabot-connect' ), $me['shop_name'] ) );
			} else {
				$settings['shop_id'] = '';
				$this->notice( 'error', __( 'Could not validate API key: ', 'kothabot-connect' ) . $me['error'] );
			}
			update_option( KOTHABOT_CONNECT_OPTION, $settings );
		}

		if ( 'sync_products' === $action ) {
			if ( class_exists( 'WooCommerce' ) ) {
				$sync = new KothaBot_Product_Sync( $this->client );
				$sync->schedule_full_sync();
				$this->notice( 'success', __( 'Product sync scheduled — products will appear in KothaBot shortly.', 'kothabot-connect' ) );
			} else {
				$this->notice( 'error', __( 'WooCommerce is not active.', 'kothabot-connect' ) );
			}
		}

		if ( 'sync_knowledge' === $action ) {
			$sync = new KothaBot_Knowledge_Sync( $this->client );
			$res  = $sync->sync( $settings['knowledge_pages'] );
			if ( $res['ok'] ) {
				$this->notice( 'success', sprintf( /* translators: %d word count */ __( 'Knowledge synced (%d words).', 'kothabot-connect' ), $res['words'] ) );
			} else {
				$this->notice( 'error', __( 'Knowledge sync failed: ', 'kothabot-connect' ) . $res['error'] );
			}
		}

		wp_safe_redirect( admin_url( 'options-general.php?page=kothabot-connect' ) );
		exit;
	}

	private function notice( $type, $message ) {
		set_transient( self::NOTICE, array( 'type' => $type, 'message' => $message ), 30 );
	}

	public function maybe_show_notice() {
		$notice = get_transient( self::NOTICE );
		if ( ! $notice ) {
			return;
		}
		delete_transient( self::NOTICE );
		printf(
			'<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
			esc_attr( 'error' === $notice['type'] ? 'error' : 'success' ),
			esc_html( $notice['message'] )
		);
	}

	public function render_page() {
		$s          = kothabot_connect_settings();
		$connected  = ! empty( $s['shop_id'] );
		$action_url = admin_url( 'options-general.php?page=kothabot-connect' );
		$pages      = get_posts( array( 'post_type' => array( 'page', 'post' ), 'numberposts' => 200, 'post_status' => 'publish', 'orderby' => 'title', 'order' => 'ASC' ) );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'KothaBot Connect', 'kothabot-connect' ); ?></h1>
			<p>
				<?php esc_html_e( 'Connection status:', 'kothabot-connect' ); ?>
				<?php if ( $connected ) : ?>
					<strong style="color:#10b981;"><?php esc_html_e( 'Connected', 'kothabot-connect' ); ?></strong>
					(<?php echo esc_html( $s['shop_id'] ); ?>)
				<?php else : ?>
					<strong style="color:#d63638;"><?php esc_html_e( 'Not connected', 'kothabot-connect' ); ?></strong>
				<?php endif; ?>
			</p>

			<form method="post" action="<?php echo esc_url( $action_url ); ?>">
				<?php wp_nonce_field( self::NONCE ); ?>
				<input type="hidden" name="kothabot_action" value="save" />

				<h2 class="title"><?php esc_html_e( 'API Credentials', 'kothabot-connect' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="api_base"><?php esc_html_e( 'KothaBot URL', 'kothabot-connect' ); ?></label></th>
						<td><input name="api_base" id="api_base" type="url" class="regular-text" value="<?php echo esc_attr( $s['api_base'] ); ?>" placeholder="https://my.kothabot.ai.bd" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="api_key"><?php esc_html_e( 'API Key', 'kothabot-connect' ); ?></label></th>
						<td>
							<input name="api_key" id="api_key" type="password" class="regular-text" value="<?php echo esc_attr( $s['api_key'] ); ?>" placeholder="kb_live_…" autocomplete="off" />
							<p class="description"><?php esc_html_e( 'Create a key in your KothaBot dashboard → Integrations → API Keys.', 'kothabot-connect' ); ?></p>
						</td>
					</tr>
				</table>

				<h2 class="title"><?php esc_html_e( 'Sync', 'kothabot-connect' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'WooCommerce products', 'kothabot-connect' ); ?></th>
						<td><label><input type="checkbox" name="sync_products" value="1" <?php checked( $s['sync_products'], 1 ); ?> /> <?php esc_html_e( 'Sync products into the AI (recommended)', 'kothabot-connect' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'WooCommerce orders', 'kothabot-connect' ); ?></th>
						<td><label><input type="checkbox" name="sync_orders" value="1" <?php checked( $s['sync_orders'], 1 ); ?> /> <?php esc_html_e( 'Push new store orders into KothaBot', 'kothabot-connect' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Page knowledge', 'kothabot-connect' ); ?></th>
						<td>
							<label><input type="checkbox" name="sync_knowledge" value="1" <?php checked( $s['sync_knowledge'], 1 ); ?> /> <?php esc_html_e( 'Feed selected pages to the AI', 'kothabot-connect' ); ?></label>
							<p><select name="knowledge_pages[]" multiple size="6" style="min-width:320px;">
								<?php foreach ( $pages as $p ) : ?>
									<option value="<?php echo esc_attr( $p->ID ); ?>" <?php echo in_array( $p->ID, (array) $s['knowledge_pages'], true ) ? 'selected' : ''; ?>>
										<?php echo esc_html( get_the_title( $p ) ); ?>
									</option>
								<?php endforeach; ?>
							</select></p>
							<p class="description"><?php esc_html_e( 'Hold Ctrl/Cmd to select multiple (e.g. About, FAQ, Services).', 'kothabot-connect' ); ?></p>
						</td>
					</tr>
				</table>

				<h2 class="title"><?php esc_html_e( 'Widget', 'kothabot-connect' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Embed widget', 'kothabot-connect' ); ?></th>
						<td><label><input type="checkbox" name="embed_widget" value="1" <?php checked( $s['embed_widget'], 1 ); ?> /> <?php esc_html_e( 'Show the voice/chat widget on the site', 'kothabot-connect' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><label for="widget_color"><?php esc_html_e( 'Color', 'kothabot-connect' ); ?></label></th>
						<td><input name="widget_color" id="widget_color" type="text" value="<?php echo esc_attr( $s['widget_color'] ); ?>" placeholder="#10b981" /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Position', 'kothabot-connect' ); ?></th>
						<td>
							<select name="widget_position">
								<option value="right" <?php selected( $s['widget_position'], 'right' ); ?>><?php esc_html_e( 'Bottom right', 'kothabot-connect' ); ?></option>
								<option value="left" <?php selected( $s['widget_position'], 'left' ); ?>><?php esc_html_e( 'Bottom left', 'kothabot-connect' ); ?></option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Language', 'kothabot-connect' ); ?></th>
						<td>
							<select name="widget_lang">
								<option value="auto" <?php selected( $s['widget_lang'], 'auto' ); ?>><?php esc_html_e( 'Auto-detect', 'kothabot-connect' ); ?></option>
								<option value="bn" <?php selected( $s['widget_lang'], 'bn' ); ?>>বাংলা</option>
								<option value="en" <?php selected( $s['widget_lang'], 'en' ); ?>>English</option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Modes', 'kothabot-connect' ); ?></th>
						<td>
							<label><input type="checkbox" name="enable_voice" value="1" <?php checked( $s['enable_voice'], 1 ); ?> /> <?php esc_html_e( 'Voice', 'kothabot-connect' ); ?></label>&nbsp;&nbsp;
							<label><input type="checkbox" name="enable_chat" value="1" <?php checked( $s['enable_chat'], 1 ); ?> /> <?php esc_html_e( 'Chat', 'kothabot-connect' ); ?></label>
						</td>
					</tr>
				</table>

				<?php submit_button( __( 'Save & Connect', 'kothabot-connect' ) ); ?>
			</form>

			<hr />
			<h2 class="title"><?php esc_html_e( 'Manual Sync', 'kothabot-connect' ); ?></h2>
			<div style="display:flex; gap:12px;">
				<form method="post" action="<?php echo esc_url( $action_url ); ?>">
					<?php wp_nonce_field( self::NONCE ); ?>
					<input type="hidden" name="kothabot_action" value="sync_products" />
					<?php submit_button( __( 'Sync all products now', 'kothabot-connect' ), 'secondary', 'submit', false ); ?>
				</form>
				<form method="post" action="<?php echo esc_url( $action_url ); ?>">
					<?php wp_nonce_field( self::NONCE ); ?>
					<input type="hidden" name="kothabot_action" value="sync_knowledge" />
					<?php submit_button( __( 'Sync page knowledge now', 'kothabot-connect' ), 'secondary', 'submit', false ); ?>
				</form>
			</div>
		</div>
		<?php
	}
}
