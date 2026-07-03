<?php
/**
 * Syncs selected WordPress pages/posts content → KothaBot AI knowledge base.
 *
 * The admin picks which pages (About, FAQ, Services, …); their cleaned content
 * is concatenated and pushed via PUT /api/v1/knowledge (one chunk per shop).
 *
 * @package KothaBot_Connect
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KothaBot_Knowledge_Sync {

	/** @var KothaBot_Client */
	private $client;

	public function __construct( KothaBot_Client $client ) {
		$this->client = $client;
	}

	/**
	 * Build the knowledge text from the selected page/post IDs.
	 *
	 * @param int[] $page_ids
	 * @return string
	 */
	public function build_content( array $page_ids ) {
		$parts = array();
		foreach ( $page_ids as $pid ) {
			$post = get_post( (int) $pid );
			if ( ! $post || 'publish' !== $post->post_status ) {
				continue;
			}

			// Gutenberg / classic editor stores content in post_content.
			$body = wp_strip_all_tags( apply_filters( 'the_content', $post->post_content ) );
			$body = trim( preg_replace( '/\s+/', ' ', $body ) );

			// Page builders (Elementor, Divi, Beaver, …) keep content in post
			// meta, so post_content comes back empty/near-empty. Fall back to
			// fetching the public permalink and extracting visible text.
			if ( strlen( $body ) < 50 ) {
				$rendered = $this->fetch_rendered( get_permalink( $post ) );
				if ( strlen( $rendered ) > strlen( $body ) ) {
					$body = $rendered;
				}
			}

			if ( $body ) {
				$parts[] = '### ' . get_the_title( $post ) . "\n" . $body;
			}
		}
		return implode( "\n\n", $parts );
	}

	/**
	 * Fetch a page's rendered HTML and reduce it to readable text.
	 * Works for any page builder because we read what the browser sees.
	 */
	private function fetch_rendered( $url ) {
		if ( empty( $url ) ) {
			return '';
		}
		$res = wp_remote_get(
			$url,
			array(
				'timeout'     => 15,
				'redirection' => 3,
				'user-agent'  => 'KothaBot-Connect/1.0',
			)
		);
		if ( is_wp_error( $res ) ) {
			return '';
		}
		$html = (string) wp_remote_retrieve_body( $res );
		if ( '' === $html ) {
			return '';
		}

		// Drop scripts, styles, nav, header, footer — they're rarely useful and
		// often big. Then narrow to <main> / <article> / <body>.
		$html = preg_replace( '#<script\b[^>]*>.*?</script>#is', ' ', $html );
		$html = preg_replace( '#<style\b[^>]*>.*?</style>#is', ' ', $html );
		$html = preg_replace( '#<(nav|header|footer)\b[^>]*>.*?</\1>#is', ' ', $html );

		if ( preg_match( '#<main\b[^>]*>(.*?)</main>#is', $html, $m ) ) {
			$html = $m[1];
		} elseif ( preg_match( '#<article\b[^>]*>(.*?)</article>#is', $html, $m ) ) {
			$html = $m[1];
		} elseif ( preg_match( '#<body\b[^>]*>(.*?)</body>#is', $html, $m ) ) {
			$html = $m[1];
		}

		$text = wp_strip_all_tags( $html );
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		return trim( preg_replace( '/\s+/', ' ', $text ) );
	}

	/**
	 * Push the selected pages' content to KothaBot.
	 *
	 * @param int[] $page_ids
	 * @return array { ok, words, error }
	 */
	public function sync( array $page_ids ) {
		$content = $this->build_content( $page_ids );
		if ( '' === $content ) {
			return array( 'ok' => false, 'words' => 0, 'error' => 'No published content in the selected pages' );
		}

		$site = get_bloginfo( 'name' );
		$res  = $this->client->put_knowledge( $content, $site . ' — Website Info' );

		return array(
			'ok'    => $res['ok'],
			'words' => $res['data']['wordCount'] ?? 0,
			'error' => $res['error'],
		);
	}
}
