// Generates and serves the MK CRM WordPress plugin as a .zip on-the-fly.
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const INGEST_URL = `${SUPABASE_URL}/functions/v1/forms-ingest`;

const PLUGIN_PHP = `<?php
/**
 * Plugin Name: MK CRM Forms
 * Description: Envia submissoes de formularios (CF7, Elementor, WPForms, Gravity, Fluent) para o MK CRM.
 * Version: 1.0.0
 * Author: MK CRM
 */
if (!defined('ABSPATH')) exit;

define('MK_CRM_INGEST_URL', ${JSON.stringify(INGEST_URL)});

class MK_CRM_Forms {
    const OPT = 'mk_crm_forms_options';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_init', [__CLASS__, 'settings']);

        // Contact Form 7
        add_action('wpcf7_mail_sent', [__CLASS__, 'on_cf7']);
        // Elementor Pro Forms
        add_action('elementor_pro/forms/new_record', [__CLASS__, 'on_elementor'], 10, 2);
        // WPForms
        add_action('wpforms_process_complete', [__CLASS__, 'on_wpforms'], 10, 4);
        // Gravity Forms
        add_action('gform_after_submission', [__CLASS__, 'on_gravity'], 10, 2);
        // Fluent Forms
        add_action('fluentform/submission_inserted', [__CLASS__, 'on_fluent'], 10, 3);
    }

    public static function menu() {
        add_options_page('MK CRM Forms', 'MK CRM Forms', 'manage_options', 'mk-crm-forms', [__CLASS__, 'page']);
    }

    public static function settings() {
        register_setting(self::OPT, self::OPT);
    }

    public static function page() {
        $opt = get_option(self::OPT, ['token' => '']);
        ?>
        <div class="wrap">
          <h1>MK CRM Forms</h1>
          <form method="post" action="options.php">
            <?php settings_fields(self::OPT); ?>
            <table class="form-table">
              <tr>
                <th><label for="token">Form Token</label></th>
                <td>
                  <input name="<?php echo self::OPT; ?>[token]" id="token" type="text" class="regular-text" value="<?php echo esc_attr($opt['token'] ?? ''); ?>" placeholder="mkf_..." />
                  <p class="description">Cole aqui o token gerado em Configuracoes &rarr; Formularios no MK CRM.</p>
                </td>
              </tr>
              <tr>
                <th>Endpoint</th>
                <td><code><?php echo esc_html(MK_CRM_INGEST_URL); ?></code></td>
              </tr>
            </table>
            <?php submit_button(); ?>
          </form>
          <h2>Como funciona</h2>
          <ol>
            <li>Crie uma integracao em <strong>Configuracoes &rarr; Formularios</strong> no MK CRM.</li>
            <li>Copie o token e cole acima.</li>
            <li>O plugin envia automaticamente envios de Contact Form 7, Elementor, WPForms, Gravity Forms e Fluent Forms.</li>
          </ol>
        </div>
        <?php
    }

    protected static function token() {
        $opt = get_option(self::OPT, []);
        return isset($opt['token']) ? trim($opt['token']) : '';
    }

    protected static function send($form_key, $form_name, $fields) {
        $token = self::token();
        if (empty($token)) return;
        $body = [
            'form_key'    => (string) $form_key,
            'form_name'   => (string) $form_name,
            'source_page' => isset($_SERVER['HTTP_REFERER']) ? esc_url_raw($_SERVER['HTTP_REFERER']) : home_url(),
            'fields'      => (object) $fields,
        ];
        if (!empty($_COOKIE['_mk_vid'])) $body['visitor_id'] = sanitize_text_field($_COOKIE['_mk_vid']);
        wp_remote_post(MK_CRM_INGEST_URL, [
            'timeout'  => 8,
            'blocking' => false,
            'headers'  => ['Content-Type' => 'application/json', 'x-form-token' => $token],
            'body'     => wp_json_encode($body),
        ]);
    }

    public static function on_cf7($contact_form) {
        $submission = class_exists('WPCF7_Submission') ? WPCF7_Submission::get_instance() : null;
        if (!$submission) return;
        $fields = $submission->get_posted_data();
        self::send('cf7-' . $contact_form->id(), $contact_form->title(), $fields);
    }

    public static function on_elementor($record, $handler) {
        $fields_raw = $record->get('fields');
        $fields = [];
        foreach ((array) $fields_raw as $k => $f) { $fields[$k] = isset($f['value']) ? $f['value'] : ''; }
        $name = $record->get_form_settings('form_name');
        $id   = $record->get_form_settings('id');
        self::send('elementor-' . ($id ?: 'form'), $name ?: 'Elementor Form', $fields);
    }

    public static function on_wpforms($fields, $entry, $form_data, $entry_id) {
        $clean = [];
        foreach ((array) $fields as $f) {
            $name = isset($f['name']) ? $f['name'] : ('field_' . (isset($f['id']) ? $f['id'] : ''));
            $clean[$name] = isset($f['value']) ? $f['value'] : '';
        }
        $fname = isset($form_data['settings']['form_title']) ? $form_data['settings']['form_title'] : 'WPForm';
        $fid   = isset($form_data['id']) ? $form_data['id'] : 'wpform';
        self::send('wpforms-' . $fid, $fname, $clean);
    }

    public static function on_gravity($entry, $form) {
        $clean = [];
        foreach ((array) $form['fields'] as $f) {
            $label = isset($f->label) ? $f->label : ('field_' . $f->id);
            $clean[$label] = rgar($entry, (string) $f->id);
        }
        self::send('gravity-' . $form['id'], $form['title'], $clean);
    }

    public static function on_fluent($insertId, $formData, $form) {
        self::send('fluent-' . (isset($form->id) ? $form->id : 'form'), isset($form->title) ? $form->title : 'Fluent Form', (array) $formData);
    }
}

MK_CRM_Forms::init();
`;

const README = `# MK CRM Forms — Plugin WordPress

1. Instale o plugin em **Plugins → Adicionar novo → Enviar plugin** (faca upload do .zip).
2. Ative o plugin.
3. Va em **Configuracoes → MK CRM Forms** e cole o token gerado no CRM.
4. Os formularios das principais ferramentas (CF7, Elementor, WPForms, Gravity, Fluent) sao enviados automaticamente.

Endpoint: ${INGEST_URL}
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const zip = new JSZip();
  zip.folder("mk-crm-forms")!.file("mk-crm-forms.php", PLUGIN_PHP);
  zip.folder("mk-crm-forms")!.file("readme.txt", README);
  const buf = await zip.generateAsync({ type: "uint8array" });
  return new Response(buf, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="mk-crm-forms.zip"',
      "Cache-Control": "public, max-age=300",
    },
  });
});
