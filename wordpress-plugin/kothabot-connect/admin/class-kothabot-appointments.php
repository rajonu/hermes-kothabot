<?php
/**
 * KothaBot Appointments Admin — Locations, Schedules, Appointments management.
 * Driven entirely by the global API key via the v1 API.
 * Client never needs to log in to the KothaBot dashboard.
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Appointments {

	/** @var KothaBot_Client */
	private $client;

	/** @var array */
	private $settings;

	public function __construct( KothaBot_Client $client, array $settings ) {
		$this->client   = $client;
		$this->settings = $settings;

		add_action( 'admin_menu', array( $this, 'register_menus' ) );
		add_action( 'admin_post_kothabot_add_location',    array( $this, 'handle_add_location' ) );
		add_action( 'admin_post_kothabot_delete_location', array( $this, 'handle_delete_location' ) );
		add_action( 'admin_post_kothabot_add_schedule',    array( $this, 'handle_add_schedule' ) );
		add_action( 'admin_post_kothabot_delete_schedule', array( $this, 'handle_delete_schedule' ) );
		add_action( 'admin_post_kothabot_add_offday',      array( $this, 'handle_add_offday' ) );
		add_action( 'admin_post_kothabot_update_appt',     array( $this, 'handle_update_appt' ) );
		add_action( 'admin_post_kothabot_add_doctor',      array( $this, 'handle_add_doctor' ) );
		add_action( 'admin_post_kothabot_add_service',     array( $this, 'handle_add_service' ) );
		add_action( 'admin_post_kothabot_delete_product',  array( $this, 'handle_delete_product' ) );
	}

	public function register_menus() {
		add_menu_page(
			__( 'KothaBot Appointments', 'kothabot-connect' ),
			__( 'KB Appointments', 'kothabot-connect' ),
			'manage_options',
			'kothabot-appointments',
			array( $this, 'page_appointments' ),
			'dashicons-calendar-alt',
			56
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Appointments', 'kothabot-connect' ),
			__( 'Appointments', 'kothabot-connect' ),
			'manage_options',
			'kothabot-appointments',
			array( $this, 'page_appointments' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Locations', 'kothabot-connect' ),
			__( 'Locations', 'kothabot-connect' ),
			'manage_options',
			'kothabot-locations',
			array( $this, 'page_locations' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Schedules', 'kothabot-connect' ),
			__( 'Working Hours', 'kothabot-connect' ),
			'manage_options',
			'kothabot-schedules',
			array( $this, 'page_schedules' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Off Days', 'kothabot-connect' ),
			__( 'Off Days', 'kothabot-connect' ),
			'manage_options',
			'kothabot-offdays',
			array( $this, 'page_offdays' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Doctors', 'kothabot-connect' ),
			__( 'Doctors', 'kothabot-connect' ),
			'manage_options',
			'kothabot-doctors',
			array( $this, 'page_doctors' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Services', 'kothabot-connect' ),
			__( 'Services', 'kothabot-connect' ),
			'manage_options',
			'kothabot-services',
			array( $this, 'page_services' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Patients', 'kothabot-connect' ),
			__( 'Patients', 'kothabot-connect' ),
			'manage_options',
			'kothabot-patients',
			array( $this, 'page_patients' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Calendar', 'kothabot-connect' ),
			__( 'Calendar', 'kothabot-connect' ),
			'manage_options',
			'kothabot-calendar',
			array( $this, 'page_calendar' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'Embed Widget', 'kothabot-connect' ),
			__( 'Embed Widget', 'kothabot-connect' ),
			'manage_options',
			'kothabot-embed',
			array( $this, 'page_embed' )
		);
		add_submenu_page(
			'kothabot-appointments',
			__( 'KothaBot Dashboard', 'kothabot-connect' ),
			__( '↗ Full Dashboard', 'kothabot-connect' ),
			'manage_options',
			'kothabot-dashboard-embed',
			array( $this, 'page_dashboard_embed' )
		);
	}

	/** Shop's widget brand color — used to keep this admin UI visually in sync with the live widget. */
	private function brand_color(): string {
		return sanitize_hex_color( $this->settings['widget_color'] ?? '' ) ?: '#10b981';
	}

	// ── Appointments list ──────────────────────────────────────────────────────

	public function page_appointments() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );
		}

		$page   = max( 1, intval( $_GET['paged'] ?? 1 ) );
		$status = sanitize_text_field( $_GET['status'] ?? '' );
		$query  = array( 'page' => $page, 'limit' => 20 );
		if ( $status ) $query['status'] = $status;

		$res  = $this->client->request( 'GET', '/api/v1/appointments?' . http_build_query( $query ) );
		$data = $res['data'] ?? array();
		$meta = $res['meta'] ?? array( 'total' => 0, 'pages' => 1, 'page' => 1 );

		// Stat cards — cheap, reuses the appointments page already fetched + one
		// small customers count call. Revenue is summed from the current page,
		// not a global aggregate (good enough for a glance, not a finance report).
		$patients_meta = $this->client->request( 'GET', '/api/v1/customers?limit=1' )['meta'] ?? array( 'total' => 0 );
		$revenue       = array_sum( array_map( fn( $a ) => floatval( $a['total_amount'] ?? 0 ), $data ) );
		$color         = $this->brand_color();
		$statuses = array( '', 'pending', 'confirmed', 'completed', 'cancelled' );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'KothaBot Appointments', 'kothabot-connect' ); ?></h1>

			<div style="display:flex;gap:16px;margin:16px 0;flex-wrap:wrap">
				<div style="flex:1;min-width:180px;background:#fff;border:1px solid #e2e2e2;border-radius:8px;padding:16px;border-top:3px solid <?php echo esc_attr( $color ); ?>">
					<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.04em"><?php esc_html_e( 'Appointments', 'kothabot-connect' ); ?></div>
					<div style="font-size:28px;font-weight:600;margin-top:4px"><?php echo esc_html( $meta['total'] ?? count( $data ) ); ?></div>
				</div>
				<div style="flex:1;min-width:180px;background:#fff;border:1px solid #e2e2e2;border-radius:8px;padding:16px;border-top:3px solid <?php echo esc_attr( $color ); ?>">
					<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.04em"><?php esc_html_e( 'Patients', 'kothabot-connect' ); ?></div>
					<div style="font-size:28px;font-weight:600;margin-top:4px"><?php echo esc_html( $patients_meta['total'] ?? 0 ); ?></div>
				</div>
				<div style="flex:1;min-width:180px;background:#fff;border:1px solid #e2e2e2;border-radius:8px;padding:16px;border-top:3px solid <?php echo esc_attr( $color ); ?>">
					<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.04em"><?php esc_html_e( 'Revenue (this page)', 'kothabot-connect' ); ?></div>
					<div style="font-size:28px;font-weight:600;margin-top:4px">৳<?php echo esc_html( number_format( $revenue, 2 ) ); ?></div>
				</div>
			</div>

			<form method="get">
				<input type="hidden" name="page" value="kothabot-appointments">
				<select name="status">
					<?php foreach ( $statuses as $s ) : ?>
						<option value="<?php echo esc_attr( $s ); ?>" <?php selected( $status, $s ); ?>>
							<?php echo $s ? esc_html( ucfirst( $s ) ) : esc_html__( 'All statuses', 'kothabot-connect' ); ?>
						</option>
					<?php endforeach; ?>
				</select>
				<?php submit_button( __( 'Filter', 'kothabot-connect' ), 'secondary', '', false ); ?>
			</form>

			<?php if ( ! $data ) : ?>
				<p><?php esc_html_e( 'No appointments found.', 'kothabot-connect' ); ?></p>
			<?php else : ?>
			<table class="widefat striped" style="margin-top:12px">
				<thead>
					<tr>
						<th><?php esc_html_e( 'Patient', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Doctor', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Service', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Date & Time', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Status', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Actions', 'kothabot-connect' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $data as $appt ) :
						$meta_data = $appt['metadata'] ?? array();
						$starts    = $appt['starts_at'] ?? $meta_data['appointment_at'] ?? '';
						$formatted = $starts ? date_i18n( 'M j, Y g:i A', strtotime( $starts ) ) : '—';
					?>
					<tr>
						<td><?php echo esc_html( $meta_data['patient_name'] ?? '—' ); ?>
							<br><small style="color:#888"><?php echo esc_html( $meta_data['patient_phone'] ?? '' ); ?></small>
						</td>
						<td><?php echo esc_html( $meta_data['doctor_name'] ?? '—' ); ?></td>
						<td><?php echo esc_html( $meta_data['service_name'] ?? '—' ); ?></td>
						<td><?php echo esc_html( $formatted ); ?></td>
						<td>
							<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:<?php echo esc_attr( $this->status_color( $appt['status'] ) ); ?>;color:#fff">
								<?php echo esc_html( ucfirst( $appt['status'] ) ); ?>
							</span>
						</td>
						<td>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
								<?php wp_nonce_field( 'kothabot_update_appt' ); ?>
								<input type="hidden" name="action" value="kothabot_update_appt">
								<input type="hidden" name="appt_id" value="<?php echo esc_attr( $appt['id'] ); ?>">
								<select name="new_status" onchange="this.form.submit()">
									<?php foreach ( array( 'pending', 'confirmed', 'completed', 'cancelled' ) as $s ) : ?>
										<option value="<?php echo esc_attr( $s ); ?>" <?php selected( $appt['status'], $s ); ?>>
											<?php echo esc_html( ucfirst( $s ) ); ?>
										</option>
									<?php endforeach; ?>
								</select>
							</form>
						</td>
					</tr>
					<?php endforeach; ?>
				</tbody>
			</table>

			<?php if ( $meta['pages'] > 1 ) : ?>
				<div class="tablenav bottom" style="margin-top:8px">
					<?php for ( $i = 1; $i <= $meta['pages']; $i++ ) : ?>
						<a href="<?php echo esc_url( add_query_arg( array( 'paged' => $i, 'page' => 'kothabot-appointments' ), admin_url( 'admin.php' ) ) ); ?>"
						   style="margin-right:4px;<?php echo $i === (int) $meta['page'] ? 'font-weight:bold' : ''; ?>">
							<?php echo esc_html( $i ); ?>
						</a>
					<?php endfor; ?>
				</div>
			<?php endif; ?>
			<?php endif; ?>
		</div>
		<?php
	}

	// ── Locations ──────────────────────────────────────────────────────────────

	public function page_locations() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );
		}

		$res  = $this->client->request( 'GET', '/api/v1/locations' );
		$locs = $res['data'] ?? array();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Clinic Locations', 'kothabot-connect' ); ?></h1>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'kothabot_add_location' ); ?>
				<input type="hidden" name="action" value="kothabot_add_location">
				<table class="form-table">
					<tr><th><?php esc_html_e( 'Branch Name', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="name" class="regular-text" required></td></tr>
					<tr><th><?php esc_html_e( 'Address', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="address" class="regular-text"></td></tr>
					<tr><th><?php esc_html_e( 'Phone', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="phone" class="regular-text"></td></tr>
				</table>
				<?php submit_button( __( 'Add Location', 'kothabot-connect' ) ); ?>
			</form>

			<hr>
			<table class="widefat striped">
				<thead><tr>
					<th><?php esc_html_e( 'Name', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Address', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Phone', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Status', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Actions', 'kothabot-connect' ); ?></th>
				</tr></thead>
				<tbody>
					<?php foreach ( $locs as $loc ) : ?>
					<tr>
						<td><?php echo esc_html( $loc['name'] ); ?></td>
						<td><?php echo esc_html( $loc['address'] ?? '—' ); ?></td>
						<td><?php echo esc_html( $loc['phone'] ?? '—' ); ?></td>
						<td><?php echo esc_html( ucfirst( $loc['status'] ) ); ?></td>
						<td>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
								<?php wp_nonce_field( 'kothabot_delete_location' ); ?>
								<input type="hidden" name="action"      value="kothabot_delete_location">
								<input type="hidden" name="location_id" value="<?php echo esc_attr( $loc['id'] ); ?>">
								<?php submit_button( __( 'Delete', 'kothabot-connect' ), 'delete small', '', false ); ?>
							</form>
						</td>
					</tr>
					<?php endforeach; ?>
					<?php if ( ! $locs ) : ?>
					<tr><td colspan="5"><?php esc_html_e( 'No locations yet.', 'kothabot-connect' ); ?></td></tr>
					<?php endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	// ── Schedules ──────────────────────────────────────────────────────────────

	public function page_schedules() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );
		}

		$all       = $this->client->request( 'GET', '/api/v1/products' )['data'] ?? array();
		$doctors   = array_values( array_filter( $all, fn( $p ) => ( $p['metadata']['product_type'] ?? 'doctor' ) === 'doctor' ) );
		$locations = $this->client->request( 'GET', '/api/v1/locations' )['data'] ?? array();
		$schedules = $this->client->request( 'GET', '/api/v1/schedules' )['data'] ?? array();
		$weekdays  = array( 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Doctor Working Hours', 'kothabot-connect' ); ?></h1>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'kothabot_add_schedule' ); ?>
				<input type="hidden" name="action" value="kothabot_add_schedule">
				<table class="form-table">
					<tr><th><?php esc_html_e( 'Doctor', 'kothabot-connect' ); ?></th>
						<td><select name="doctor_id" required>
							<option value=""><?php esc_html_e( '— Select —', 'kothabot-connect' ); ?></option>
							<?php foreach ( $doctors as $d ) : ?>
								<option value="<?php echo esc_attr( $d['id'] ); ?>"><?php echo esc_html( $d['name'] ); ?></option>
							<?php endforeach; ?>
						</select></td></tr>
					<tr><th><?php esc_html_e( 'Day', 'kothabot-connect' ); ?></th>
						<td><select name="weekday">
							<?php foreach ( $weekdays as $i => $d ) : ?>
								<option value="<?php echo esc_attr( $i ); ?>"><?php echo esc_html( $d ); ?></option>
							<?php endforeach; ?>
						</select></td></tr>
					<tr><th><?php esc_html_e( 'Start Time', 'kothabot-connect' ); ?></th>
						<td><input type="time" name="start_time" value="09:00" required></td></tr>
					<tr><th><?php esc_html_e( 'End Time', 'kothabot-connect' ); ?></th>
						<td><input type="time" name="end_time" value="17:00" required></td></tr>
					<tr><th><?php esc_html_e( 'Location (optional)', 'kothabot-connect' ); ?></th>
						<td><select name="location_id">
							<option value=""><?php esc_html_e( 'Any', 'kothabot-connect' ); ?></option>
							<?php foreach ( $locations as $l ) : ?>
								<option value="<?php echo esc_attr( $l['id'] ); ?>"><?php echo esc_html( $l['name'] ); ?></option>
							<?php endforeach; ?>
						</select></td></tr>
				</table>
				<?php submit_button( __( 'Add Working Hours', 'kothabot-connect' ) ); ?>
			</form>

			<hr>
			<table class="widefat striped">
				<thead><tr>
					<th><?php esc_html_e( 'Doctor', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Day', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Hours', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Location', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Actions', 'kothabot-connect' ); ?></th>
				</tr></thead>
				<tbody>
					<?php foreach ( $schedules as $s ) :
						$doc_name = '';
						foreach ( $doctors as $d ) {
							if ( $d['id'] === $s['doctor_id'] ) { $doc_name = $d['name']; break; }
						}
						$loc_name = '';
						foreach ( $locations as $l ) {
							if ( $l['id'] === ( $s['location_id'] ?? '' ) ) { $loc_name = $l['name']; break; }
						}
					?>
					<tr>
						<td><?php echo esc_html( $doc_name ); ?></td>
						<td><?php echo esc_html( $weekdays[ $s['weekday'] ] ?? '' ); ?></td>
						<td><?php echo esc_html( $s['start_time'] . '–' . $s['end_time'] ); ?></td>
						<td><?php echo esc_html( $loc_name ?: '—' ); ?></td>
						<td>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
								<?php wp_nonce_field( 'kothabot_delete_schedule' ); ?>
								<input type="hidden" name="action"       value="kothabot_delete_schedule">
								<input type="hidden" name="doctor_id"    value="<?php echo esc_attr( $s['doctor_id'] ); ?>">
								<input type="hidden" name="weekday"      value="<?php echo esc_attr( $s['weekday'] ); ?>">
								<?php submit_button( __( 'Remove', 'kothabot-connect' ), 'delete small', '', false ); ?>
							</form>
						</td>
					</tr>
					<?php endforeach; ?>
					<?php if ( ! $schedules ) : ?>
					<tr><td colspan="5"><?php esc_html_e( 'No schedules yet.', 'kothabot-connect' ); ?></td></tr>
					<?php endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	// ── Off Days ───────────────────────────────────────────────────────────────

	public function page_offdays() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );
		}

		$all      = $this->client->request( 'GET', '/api/v1/products' )['data'] ?? array();
		$doctors  = array_values( array_filter( $all, fn( $p ) => ( $p['metadata']['product_type'] ?? 'doctor' ) === 'doctor' ) );
		$offdays  = $this->client->request( 'GET', '/api/v1/special-days' )['data'] ?? array();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Off Days & Holidays', 'kothabot-connect' ); ?></h1>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'kothabot_add_offday' ); ?>
				<input type="hidden" name="action" value="kothabot_add_offday">
				<table class="form-table">
					<tr><th><?php esc_html_e( 'Date', 'kothabot-connect' ); ?></th>
						<td><input type="date" name="date" required></td></tr>
					<tr><th><?php esc_html_e( 'Type', 'kothabot-connect' ); ?></th>
						<td><select name="type">
							<option value="off"><?php esc_html_e( 'Full Day Off', 'kothabot-connect' ); ?></option>
							<option value="holiday"><?php esc_html_e( 'Public Holiday', 'kothabot-connect' ); ?></option>
						</select></td></tr>
					<tr><th><?php esc_html_e( 'Doctor (optional)', 'kothabot-connect' ); ?></th>
						<td><select name="doctor_id">
							<option value=""><?php esc_html_e( 'All doctors', 'kothabot-connect' ); ?></option>
							<?php foreach ( $doctors as $d ) : ?>
								<option value="<?php echo esc_attr( $d['id'] ); ?>"><?php echo esc_html( $d['name'] ); ?></option>
							<?php endforeach; ?>
						</select></td></tr>
					<tr><th><?php esc_html_e( 'Note', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="note" class="regular-text"></td></tr>
				</table>
				<?php submit_button( __( 'Add Off Day', 'kothabot-connect' ) ); ?>
			</form>

			<hr>
			<table class="widefat striped">
				<thead><tr>
					<th><?php esc_html_e( 'Date', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Type', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Doctor', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Note', 'kothabot-connect' ); ?></th>
				</tr></thead>
				<tbody>
					<?php foreach ( $offdays as $od ) :
						$doc_name = '';
						foreach ( $doctors as $d ) {
							if ( $d['id'] === ( $od['doctor_id'] ?? '' ) ) { $doc_name = $d['name']; break; }
						}
					?>
					<tr>
						<td><?php echo esc_html( $od['date'] ); ?></td>
						<td><?php echo esc_html( ucfirst( $od['type'] ) ); ?></td>
						<td><?php echo esc_html( $doc_name ?: esc_html__( 'All', 'kothabot-connect' ) ); ?></td>
						<td><?php echo esc_html( $od['note'] ?? '—' ); ?></td>
					</tr>
					<?php endforeach; ?>
					<?php if ( ! $offdays ) : ?>
					<tr><td colspan="4"><?php esc_html_e( 'No off days configured.', 'kothabot-connect' ); ?></td></tr>
					<?php endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	// ── Action handlers ────────────────────────────────────────────────────────

	public function handle_add_location() {
		check_admin_referer( 'kothabot_add_location' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$this->client->request( 'POST', '/api/v1/locations', array(
			'name'    => sanitize_text_field( $_POST['name']    ?? '' ),
			'address' => sanitize_text_field( $_POST['address'] ?? '' ),
			'phone'   => sanitize_text_field( $_POST['phone']   ?? '' ),
		) );
		wp_redirect( admin_url( 'admin.php?page=kothabot-locations&saved=1' ) );
		exit;
	}

	public function handle_delete_location() {
		check_admin_referer( 'kothabot_delete_location' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$id = sanitize_text_field( $_POST['location_id'] ?? '' );
		if ( $id ) $this->client->request( 'DELETE', '/api/v1/locations/' . $id );
		wp_redirect( admin_url( 'admin.php?page=kothabot-locations&deleted=1' ) );
		exit;
	}

	public function handle_add_schedule() {
		check_admin_referer( 'kothabot_add_schedule' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$this->client->request( 'POST', '/api/v1/schedules', array(
			'doctor_id'   => sanitize_text_field( $_POST['doctor_id']   ?? '' ),
			'weekday'     => intval( $_POST['weekday'] ?? 0 ),
			'start_time'  => sanitize_text_field( $_POST['start_time']  ?? '09:00' ),
			'end_time'    => sanitize_text_field( $_POST['end_time']    ?? '17:00' ),
			'location_id' => sanitize_text_field( $_POST['location_id'] ?? '' ) ?: null,
		) );
		wp_redirect( admin_url( 'admin.php?page=kothabot-schedules&saved=1' ) );
		exit;
	}

	public function handle_delete_schedule() {
		check_admin_referer( 'kothabot_delete_schedule' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$doctor_id = sanitize_text_field( $_POST['doctor_id'] ?? '' );
		$weekday   = intval( $_POST['weekday'] ?? 0 );
		if ( $doctor_id ) {
			$this->client->request( 'DELETE', '/api/v1/schedules?doctor_id=' . urlencode( $doctor_id ) . '&weekday=' . $weekday );
		}
		wp_redirect( admin_url( 'admin.php?page=kothabot-schedules&deleted=1' ) );
		exit;
	}

	public function handle_add_offday() {
		check_admin_referer( 'kothabot_add_offday' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$this->client->request( 'POST', '/api/v1/special-days', array(
			'date'      => sanitize_text_field( $_POST['date']      ?? '' ),
			'type'      => sanitize_text_field( $_POST['type']      ?? 'off' ),
			'doctor_id' => sanitize_text_field( $_POST['doctor_id'] ?? '' ) ?: null,
			'note'      => sanitize_text_field( $_POST['note']      ?? '' ),
		) );
		wp_redirect( admin_url( 'admin.php?page=kothabot-offdays&saved=1' ) );
		exit;
	}

	public function handle_update_appt() {
		check_admin_referer( 'kothabot_update_appt' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$id     = sanitize_text_field( $_POST['appt_id']    ?? '' );
		$status = sanitize_text_field( $_POST['new_status'] ?? '' );
		if ( $id && $status ) {
			$this->client->request( 'PUT', '/api/v1/appointments/' . $id, array( 'status' => $status ) );
		}
		wp_redirect( admin_url( 'admin.php?page=kothabot-appointments&updated=1' ) );
		exit;
	}

	// ── Doctors ────────────────────────────────────────────────────────────────

	public function page_doctors() {
		if ( ! current_user_can( 'manage_options' ) ) wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );
		$all      = $this->client->request( 'GET', '/api/v1/products' )['data'] ?? array();
		$products = array_values( array_filter( $all, fn( $p ) => ( $p['metadata']['product_type'] ?? 'doctor' ) === 'doctor' ) );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Doctors', 'kothabot-connect' ); ?></h1>
			<?php $this->notice_bar(); ?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'kothabot_add_doctor' ); ?>
				<input type="hidden" name="action" value="kothabot_add_doctor">
				<h2><?php esc_html_e( 'Add Doctor', 'kothabot-connect' ); ?></h2>
				<table class="form-table">
					<tr><th><?php esc_html_e( 'Name', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="name" class="regular-text" required></td></tr>
					<tr><th><?php esc_html_e( 'Specialization', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="specialization" class="regular-text"></td></tr>
					<tr><th><?php esc_html_e( 'Department', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="department" class="regular-text"></td></tr>
					<tr><th><?php esc_html_e( 'Consultation Fee', 'kothabot-connect' ); ?></th>
						<td><input type="number" name="fee" min="0" step="0.01"></td></tr>
					<tr><th><?php esc_html_e( 'Slot Duration (min)', 'kothabot-connect' ); ?></th>
						<td><input type="number" name="duration_min" value="30" min="5" step="5"></td></tr>
				</table>
				<?php submit_button( __( 'Add Doctor', 'kothabot-connect' ) ); ?>
			</form>

			<hr>
			<table class="widefat striped">
				<thead><tr>
					<th><?php esc_html_e( 'Name', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Specialization', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Department', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Fee', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Duration', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Available', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Actions', 'kothabot-connect' ); ?></th>
				</tr></thead>
				<tbody>
					<?php foreach ( $products as $p ) :
						$m = $p['metadata'] ?? array();
					?>
					<tr>
						<td><strong><?php echo esc_html( $p['name'] ); ?></strong></td>
						<td><?php echo esc_html( $m['specialization'] ?? '—' ); ?></td>
						<td><?php echo esc_html( $m['department'] ?? '—' ); ?></td>
						<td><?php echo esc_html( isset( $m['consultation_fee'] ) ? '৳' . $m['consultation_fee'] : '—' ); ?></td>
						<td><?php echo esc_html( isset( $m['duration_min'] ) ? $m['duration_min'] . ' min' : '30 min' ); ?></td>
						<td><?php echo $p['is_available'] ? '✅' : '❌'; ?></td>
						<td>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
								<?php wp_nonce_field( 'kothabot_delete_product' ); ?>
								<input type="hidden" name="action"     value="kothabot_delete_product">
								<input type="hidden" name="product_id" value="<?php echo esc_attr( $p['id'] ); ?>">
								<input type="hidden" name="redirect"   value="kothabot-doctors">
								<?php submit_button( __( 'Delete', 'kothabot-connect' ), 'delete small', '', false,
									array( 'onclick' => "return confirm('Delete this doctor?')" ) ); ?>
							</form>
						</td>
					</tr>
					<?php endforeach; ?>
					<?php if ( ! $products ) : ?>
					<tr><td colspan="7"><?php esc_html_e( 'No doctors yet. Add one above.', 'kothabot-connect' ); ?></td></tr>
					<?php endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	// ── Services ───────────────────────────────────────────────────────────────

	public function page_services() {
		if ( ! current_user_can( 'manage_options' ) ) wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );
		$all      = $this->client->request( 'GET', '/api/v1/products' )['data'] ?? array();
		$products = array_values( array_filter( $all, fn( $p ) => ( $p['metadata']['product_type'] ?? '' ) === 'service' ) );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Services', 'kothabot-connect' ); ?></h1>
			<?php $this->notice_bar(); ?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'kothabot_add_service' ); ?>
				<input type="hidden" name="action" value="kothabot_add_service">
				<h2><?php esc_html_e( 'Add Service', 'kothabot-connect' ); ?></h2>
				<table class="form-table">
					<tr><th><?php esc_html_e( 'Name', 'kothabot-connect' ); ?></th>
						<td><input type="text" name="name" class="regular-text" required></td></tr>
					<tr><th><?php esc_html_e( 'Price', 'kothabot-connect' ); ?></th>
						<td><input type="number" name="price" min="0" step="0.01" class="small-text"> ৳</td></tr>
					<tr><th><?php esc_html_e( 'Duration (min)', 'kothabot-connect' ); ?></th>
						<td><input type="number" name="duration_min" value="30" min="5" step="5" class="small-text"></td></tr>
					<tr><th><?php esc_html_e( 'Description', 'kothabot-connect' ); ?></th>
						<td><textarea name="description" class="regular-text" rows="2"></textarea></td></tr>
				</table>
				<?php submit_button( __( 'Add Service', 'kothabot-connect' ) ); ?>
			</form>

			<hr>
			<table class="widefat striped">
				<thead><tr>
					<th><?php esc_html_e( 'Name', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Price', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Duration', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Available', 'kothabot-connect' ); ?></th>
					<th><?php esc_html_e( 'Actions', 'kothabot-connect' ); ?></th>
				</tr></thead>
				<tbody>
					<?php foreach ( $products as $p ) :
						$m = $p['metadata'] ?? array();
					?>
					<tr>
						<td><strong><?php echo esc_html( $p['name'] ); ?></strong></td>
						<td><?php echo esc_html( $p['price'] ? '৳' . $p['price'] : '—' ); ?></td>
						<td><?php echo esc_html( isset( $m['duration_min'] ) ? $m['duration_min'] . ' min' : '30 min' ); ?></td>
						<td><?php echo $p['is_available'] ? '✅' : '❌'; ?></td>
						<td>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
								<?php wp_nonce_field( 'kothabot_delete_product' ); ?>
								<input type="hidden" name="action"     value="kothabot_delete_product">
								<input type="hidden" name="product_id" value="<?php echo esc_attr( $p['id'] ); ?>">
								<input type="hidden" name="redirect"   value="kothabot-services">
								<?php submit_button( __( 'Delete', 'kothabot-connect' ), 'delete small', '', false,
									array( 'onclick' => "return confirm('Delete this service?')" ) ); ?>
							</form>
						</td>
					</tr>
					<?php endforeach; ?>
					<?php if ( ! $products ) : ?>
					<tr><td colspan="5"><?php esc_html_e( 'No services yet. Add one above.', 'kothabot-connect' ); ?></td></tr>
					<?php endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	// ── Patients ───────────────────────────────────────────────────────────────

	public function page_patients() {
		if ( ! current_user_can( 'manage_options' ) ) wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );

		$page   = max( 1, intval( $_GET['paged'] ?? 1 ) );
		$search = sanitize_text_field( $_GET['s'] ?? '' );
		$query  = array( 'page' => $page, 'limit' => 20 );
		if ( $search ) $query['search'] = $search;

		$res  = $this->client->request( 'GET', '/api/v1/customers?' . http_build_query( $query ) );
		$data = $res['data'] ?? array();
		$meta = $res['meta'] ?? array( 'total' => 0, 'pages' => 1, 'page' => 1 );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Patients', 'kothabot-connect' ); ?></h1>

			<form method="get">
				<input type="hidden" name="page" value="kothabot-patients">
				<input type="search" name="s" value="<?php echo esc_attr( $search ); ?>" placeholder="<?php esc_attr_e( 'Search name or phone…', 'kothabot-connect' ); ?>">
				<?php submit_button( __( 'Search', 'kothabot-connect' ), 'secondary', '', false ); ?>
			</form>

			<?php if ( ! $data ) : ?>
				<p><?php esc_html_e( 'No patients found.', 'kothabot-connect' ); ?></p>
			<?php else : ?>
			<table class="widefat striped" style="margin-top:12px">
				<thead>
					<tr>
						<th><?php esc_html_e( 'Name', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Phone', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Address', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Visits', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Lifetime Value', 'kothabot-connect' ); ?></th>
						<th><?php esc_html_e( 'Patient Since', 'kothabot-connect' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $data as $c ) : ?>
					<tr>
						<td><strong><?php echo esc_html( $c['name'] ?? '—' ); ?></strong></td>
						<td><?php echo esc_html( $c['phone'] ?? '—' ); ?></td>
						<td><?php echo esc_html( $c['address'] ?? '—' ); ?></td>
						<td><?php echo esc_html( $c['order_count'] ?? 0 ); ?></td>
						<td><?php echo esc_html( isset( $c['lifetime_value'] ) ? '৳' . $c['lifetime_value'] : '—' ); ?></td>
						<td><?php echo esc_html( ! empty( $c['created_at'] ) ? date_i18n( 'M j, Y', strtotime( $c['created_at'] ) ) : '—' ); ?></td>
					</tr>
					<?php endforeach; ?>
				</tbody>
			</table>

			<?php if ( $meta['pages'] > 1 ) : ?>
				<div class="tablenav bottom" style="margin-top:8px">
					<?php for ( $i = 1; $i <= $meta['pages']; $i++ ) : ?>
						<a href="<?php echo esc_url( add_query_arg( array( 'paged' => $i, 'page' => 'kothabot-patients', 's' => $search ), admin_url( 'admin.php' ) ) ); ?>"
						   style="margin-right:4px;<?php echo $i === (int) $meta['page'] ? 'font-weight:bold' : ''; ?>">
							<?php echo esc_html( $i ); ?>
						</a>
					<?php endfor; ?>
				</div>
			<?php endif; ?>
			<?php endif; ?>
		</div>
		<?php
	}

	// ── Calendar ───────────────────────────────────────────────────────────────

	public function page_calendar() {
		if ( ! current_user_can( 'manage_options' ) ) wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );

		$color = $this->brand_color();
		$year  = intval( $_GET['year']  ?? date( 'Y' ) );
		$month = intval( $_GET['month'] ?? date( 'n' ) );
		$month = max( 1, min( 12, $month ) );

		// Fetch appointments for this month
		$from = sprintf( '%04d-%02d-01', $year, $month );
		$to   = date( 'Y-m-t', strtotime( $from ) );
		$res  = $this->client->request( 'GET', '/api/v1/appointments?limit=200&from=' . $from . '&to=' . $to );
		$appts = $res['data'] ?? array();

		// Index by date
		$by_date = array();
		foreach ( $appts as $a ) {
			$starts = $a['starts_at'] ?? ( $a['metadata']['appointment_at'] ?? '' );
			if ( ! $starts ) continue;
			$d = date( 'j', strtotime( $starts ) );
			$by_date[ $d ][] = $a;
		}

		$first_dow = (int) date( 'w', strtotime( $from ) ); // 0=Sun
		$days_in   = (int) date( 't', strtotime( $from ) );
		$month_name = date( 'F Y', strtotime( $from ) );

		$prev_month = $month === 1 ? array( 'year' => $year - 1, 'month' => 12 ) : array( 'year' => $year, 'month' => $month - 1 );
		$next_month = $month === 12 ? array( 'year' => $year + 1, 'month' => 1  ) : array( 'year' => $year, 'month' => $month + 1 );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Appointment Calendar', 'kothabot-connect' ); ?></h1>

			<div class="notice notice-info inline" style="margin:8px 0 16px">
				<p>
					<?php esc_html_e( 'Appointments booked here sync automatically to the clinic\'s connected Google Calendar — no extra setup needed.', 'kothabot-connect' ); ?>
					<a href="<?php echo esc_url( untrailingslashit( $this->settings['api_base'] ?? 'https://my.kothabot.ai.bd' ) . '/integrations' ); ?>" target="_blank">
						<?php esc_html_e( 'Manage Google Calendar connection →', 'kothabot-connect' ); ?>
					</a>
				</p>
			</div>

			<div style="display:flex;align-items:center;gap:16px;margin:12px 0">
				<a href="<?php echo esc_url( add_query_arg( array( 'page' => 'kothabot-calendar', 'year' => $prev_month['year'], 'month' => $prev_month['month'] ), admin_url( 'admin.php' ) ) ); ?>"
				   class="button">← <?php esc_html_e( 'Prev', 'kothabot-connect' ); ?></a>
				<h2 style="margin:0"><?php echo esc_html( $month_name ); ?></h2>
				<a href="<?php echo esc_url( add_query_arg( array( 'page' => 'kothabot-calendar', 'year' => $next_month['year'], 'month' => $next_month['month'] ), admin_url( 'admin.php' ) ) ); ?>"
				   class="button"><?php esc_html_e( 'Next', 'kothabot-connect' ); ?> →</a>
			</div>

			<table style="width:100%;border-collapse:collapse;table-layout:fixed">
				<thead>
					<tr><?php foreach ( array( 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ) as $wd ) : ?>
						<th style="border:1px solid #ddd;padding:8px;text-align:center;background:#f0f0f0"><?php echo esc_html( $wd ); ?></th>
					<?php endforeach; ?></tr>
				</thead>
				<tbody>
				<?php
				$day = 1; $col = 0;
				echo '<tr>';
				// Empty cells before month starts
				for ( $c = 0; $c < $first_dow; $c++ ) {
					echo '<td style="border:1px solid #ddd;padding:4px;height:80px;background:#fafafa"></td>';
					$col++;
				}
				while ( $day <= $days_in ) {
					if ( $col === 7 ) { echo '</tr><tr>'; $col = 0; }
					$is_today = ( date( 'Y-m-d' ) === sprintf( '%04d-%02d-%02d', $year, $month, $day ) );
					$cell_style = $is_today
						? 'border:2px solid ' . esc_attr( $color ) . ';background:#fff'
						: 'border:1px solid #ddd;background:#fff';
					echo '<td style="' . $cell_style . ';padding:4px;height:80px;vertical-align:top">';
					echo '<strong style="font-size:13px">' . esc_html( $day ) . '</strong>';
					if ( isset( $by_date[ $day ] ) ) {
						foreach ( $by_date[ $day ] as $a ) {
							$m   = $a['metadata'] ?? array();
							$t   = $a['starts_at'] ?? $m['appointment_at'] ?? '';
							$lbl = $t ? date( 'g:i A', strtotime( $t ) ) : '';
							$clr = $this->status_color( $a['status'] );
							printf(
								'<div style="margin-top:2px;padding:2px 4px;border-radius:3px;background:%s;color:#fff;font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="%s">%s %s</div>',
								esc_attr( $clr ),
								esc_attr( ( $m['patient_name'] ?? '' ) . ' — ' . ( $m['doctor_name'] ?? '' ) ),
								esc_html( $lbl ),
								esc_html( $m['patient_name'] ?? '' )
							);
						}
					}
					echo '</td>';
					$day++; $col++;
				}
				// Fill remaining cells
				while ( $col < 7 && $col > 0 ) {
					echo '<td style="border:1px solid #ddd;padding:4px;height:80px;background:#fafafa"></td>';
					$col++;
				}
				echo '</tr>';
				?>
				</tbody>
			</table>

			<p style="margin-top:8px;font-size:12px;color:#888">
				<?php printf( esc_html__( '%d appointment(s) this month.', 'kothabot-connect' ), count( $appts ) ); ?>
			</p>
		</div>
		<?php
	}

	// ── Embed Widget (code + live preview) ──────────────────────────────────────

	public function page_embed() {
		if ( ! current_user_can( 'manage_options' ) ) wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );

		$s       = $this->settings;
		$base    = untrailingslashit( $s['api_base'] ?? '' );
		$shop_id = $s['shop_id'] ?? '';
		$color   = $this->brand_color();

		$snippet = sprintf(
			"<script src=\"%s/embed.js\" data-shop=\"%s\" data-color=\"%s\" data-position=\"%s\" data-lang=\"%s\" data-voice=\"%s\" data-chat=\"%s\" async></script>",
			$base, $shop_id, $color, $s['widget_position'] ?? 'right', $s['widget_lang'] ?? 'auto',
			! empty( $s['enable_voice'] ) ? '1' : '0', ! empty( $s['enable_chat'] ) ? '1' : '0'
		);
		$widget_preview_url = $base && $shop_id
			? add_query_arg( array( 'color' => $color, 'lang' => $s['widget_lang'] ?? 'auto' ), $base . '/widget/' . $shop_id )
			: '';
		$booking_url     = $base && $shop_id ? $base . '/book/' . $shop_id : '';
		$booking_snippet = $booking_url
			? sprintf( "<iframe src=\"%s\" style=\"width:100%%;max-width:600px;height:800px;border:0\"></iframe>", esc_url_raw( $booking_url ) )
			: '';
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Embed Widget', 'kothabot-connect' ); ?></h1>

			<?php if ( empty( $shop_id ) ) : ?>
				<div class="notice notice-warning inline"><p><?php esc_html_e( 'Connect your API key first under Settings → KothaBot.', 'kothabot-connect' ); ?></p></div>
				<?php return; ?>
			<?php endif; ?>

			<h2 class="title"><?php esc_html_e( 'Voice/Chat Widget', 'kothabot-connect' ); ?></h2>
			<p><?php esc_html_e( 'The "Embed widget" toggle in Settings already adds this automatically site-wide. Use this for manual placement, or to preview how it looks/sounds before turning it on.', 'kothabot-connect' ); ?></p>

			<textarea id="kothabot-embed-snippet" readonly class="large-text code" rows="2" style="max-width:700px"><?php echo esc_textarea( $snippet ); ?></textarea>
			<p>
				<button type="button" class="button button-secondary" onclick="
					var t=document.getElementById('kothabot-embed-snippet'); t.select(); document.execCommand('copy');
					this.textContent='<?php echo esc_js( __( 'Copied!', 'kothabot-connect' ) ); ?>';
				"><?php esc_html_e( 'Copy to clipboard', 'kothabot-connect' ); ?></button>
			</p>

			<p class="description"><?php esc_html_e( 'Matches your saved color, position, and language settings.', 'kothabot-connect' ); ?></p>
			<iframe src="<?php echo esc_url( $widget_preview_url ); ?>"
				style="width:380px;height:640px;border:1px solid #ddd;border-radius:12px;display:block"
				allow="microphone"></iframe>

			<hr style="margin:32px 0">

			<h2 class="title"><?php esc_html_e( 'Booking Form', 'kothabot-connect' ); ?></h2>
			<p><?php esc_html_e( 'Embed the full appointment booking form directly on any page or post (e.g. a "Book Now" page) using this iframe snippet.', 'kothabot-connect' ); ?></p>

			<textarea id="kothabot-booking-snippet" readonly class="large-text code" rows="2" style="max-width:700px"><?php echo esc_textarea( $booking_snippet ); ?></textarea>
			<p>
				<button type="button" class="button button-secondary" onclick="
					var t=document.getElementById('kothabot-booking-snippet'); t.select(); document.execCommand('copy');
					this.textContent='<?php echo esc_js( __( 'Copied!', 'kothabot-connect' ) ); ?>';
				"><?php esc_html_e( 'Copy to clipboard', 'kothabot-connect' ); ?></button>
				<a href="<?php echo esc_url( $booking_url ); ?>" target="_blank" class="button"><?php esc_html_e( 'Open booking form ↗', 'kothabot-connect' ); ?></a>
			</p>

			<p class="description"><?php esc_html_e( 'Live preview:', 'kothabot-connect' ); ?></p>
			<iframe src="<?php echo esc_url( $booking_url ); ?>"
				style="width:100%;max-width:600px;height:800px;border:1px solid #ddd;border-radius:12px;display:block"></iframe>
		</div>
		<?php
	}

	// ── Dashboard Embed ────────────────────────────────────────────────────────

	public function page_dashboard_embed() {
		if ( ! current_user_can( 'manage_options' ) ) wp_die( esc_html__( 'Unauthorized', 'kothabot-connect' ) );

		// Fetch a magic auto-login URL from the API
		$res      = $this->client->request( 'GET', '/api/wp/embed-url' );
		$embed_url = $res['url'] ?? '';
		$api_base  = $this->settings['api_base'] ?? 'https://my.kothabot.ai.bd';
		?>
		<div class="wrap" style="padding:0">
			<h1 style="padding:8px 16px"><?php esc_html_e( 'KothaBot Dashboard', 'kothabot-connect' ); ?>
				<?php if ( $embed_url ) : ?>
				<a href="<?php echo esc_url( $embed_url ); ?>" target="_blank" class="button button-secondary" style="margin-left:8px">
					<?php esc_html_e( 'Open in new tab', 'kothabot-connect' ); ?>
				</a>
				<?php endif; ?>
			</h1>

			<?php if ( $embed_url ) : ?>
			<iframe
				src="<?php echo esc_url( $embed_url ); ?>"
				style="width:100%;height:calc(100vh - 120px);border:none;display:block"
				allow="microphone"
			></iframe>
			<?php else : ?>
			<div style="padding:24px">
				<div class="notice notice-warning inline">
					<p><?php esc_html_e( 'Could not generate auto-login link. Make sure your API key is configured and valid.', 'kothabot-connect' ); ?></p>
				</div>
				<p>
					<a href="<?php echo esc_url( $api_base . '/dashboard' ); ?>" target="_blank" class="button button-primary">
						<?php esc_html_e( 'Open KothaBot Dashboard', 'kothabot-connect' ); ?>
					</a>
				</p>
			</div>
			<?php endif; ?>
		</div>
		<?php
	}

	// ── New action handlers ────────────────────────────────────────────────────

	public function handle_add_doctor() {
		check_admin_referer( 'kothabot_add_doctor' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$fee = $_POST['fee'] ?? '';
		$dur = intval( $_POST['duration_min'] ?? 30 );
		$this->client->request( 'POST', '/api/v1/products', array(
			'name'     => sanitize_text_field( $_POST['name'] ?? '' ),
			'metadata' => array_filter( array(
				'product_type'      => 'doctor',
				'specialization'    => sanitize_text_field( $_POST['specialization'] ?? '' ),
				'department'        => sanitize_text_field( $_POST['department']     ?? '' ),
				'consultation_fee'  => $fee !== '' ? floatval( $fee ) : null,
				'duration_min'      => $dur ?: 30,
			) ),
		) );
		wp_redirect( admin_url( 'admin.php?page=kothabot-doctors&saved=1' ) );
		exit;
	}

	public function handle_add_service() {
		check_admin_referer( 'kothabot_add_service' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$price = $_POST['price'] ?? '';
		$dur   = intval( $_POST['duration_min'] ?? 30 );
		$this->client->request( 'POST', '/api/v1/products', array(
			'name'        => sanitize_text_field( $_POST['name']        ?? '' ),
			'price'       => $price !== '' ? floatval( $price ) : null,
			'description' => sanitize_textarea_field( $_POST['description'] ?? '' ),
			'metadata'    => array( 'product_type' => 'service', 'duration_min' => $dur ?: 30 ),
		) );
		wp_redirect( admin_url( 'admin.php?page=kothabot-services&saved=1' ) );
		exit;
	}

	public function handle_delete_product() {
		check_admin_referer( 'kothabot_delete_product' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$id       = sanitize_text_field( $_POST['product_id'] ?? '' );
		$redirect = sanitize_text_field( $_POST['redirect']   ?? 'kothabot-doctors' );
		if ( $id ) $this->client->request( 'DELETE', '/api/v1/products/' . $id );
		wp_redirect( admin_url( 'admin.php?page=' . $redirect . '&deleted=1' ) );
		exit;
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	private function notice_bar(): void {
		if ( ! empty( $_GET['saved'] ) ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Saved.', 'kothabot-connect' ) . '</p></div>';
		}
		if ( ! empty( $_GET['deleted'] ) ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Deleted.', 'kothabot-connect' ) . '</p></div>';
		}
	}

	private function status_color( ?string $status ): string {
		return array(
			'pending'    => '#f59e0b',
			'confirmed'  => '#10b981',
			'completed'  => '#6b7280',
			'cancelled'  => '#ef4444',
			'processing' => '#3b82f6',
		)[ $status ] ?? '#6b7280';
	}
}
