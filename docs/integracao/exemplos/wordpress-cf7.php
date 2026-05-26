<?php
/**
 * Plugin Name: MK-CRM × Contact Form 7
 * Description: Envia toda submission do CF7 para o forms-ingest do MK-CRM.
 * Version: 1.0.0
 *
 * Cole este arquivo em wp-content/plugins/mk-crm-cf7/mk-crm-cf7.php e ative.
 */

if (!defined('ABSPATH')) exit;

// === CONFIGURE AQUI ===
define('MK_CRM_TOKEN', 'SEU_TOKEN_PUBLICO');
define('MK_CRM_INGEST_URL', 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-ingest');

add_action('wpcf7_mail_sent', function ($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;

    $data = $submission->get_posted_data();

    // Pega o visitor_id do cookie (se o MK Tracker estiver instalado)
    $visitor_id = isset($_COOKIE['_mk_vid']) ? $_COOKIE['_mk_vid'] : null;

    $payload = [
        'form_key'    => 'cf7_' . $contact_form->id(),
        'form_name'   => $contact_form->title(),
        'source_page' => isset($_SERVER['HTTP_REFERER']) ? esc_url_raw($_SERVER['HTTP_REFERER']) : '',
        'fields'      => $data,
        'visitor_id'  => $visitor_id,
    ];

    wp_remote_post(MK_CRM_INGEST_URL, [
        'headers'  => [
            'Content-Type' => 'application/json',
            'x-form-token' => MK_CRM_TOKEN,
        ],
        'body'     => wp_json_encode($payload),
        'timeout'  => 5,
        'blocking' => false, // fire-and-forget, não bloqueia o submit do CF7
    ]);
});
