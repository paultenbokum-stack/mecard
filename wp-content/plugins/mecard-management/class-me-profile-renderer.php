<?php
namespace Me\Profile_Renderer;

if ( ! defined( 'ABSPATH' ) ) exit;

class Module {

    /**
     * Master entry point. Picks template based on $profile['type'].
     *
     * @param array  $profile  Output of Me\Preview\Module::get_profile_data()
     * @param array  $company  Output of Me\Preview\Module::get_company_data()
     * @param string $context  'public' | 'preview'
     */
    public static function render( array $profile, array $company, string $context = 'public' ): void {
        $type = $profile['type'] ?? 'standard';
        if ( $type === 'professional' || $type === 'pro' ) {
            self::render_pro( $profile, $company, $context );
        } else {
            self::render_standard( $profile, $company, $context );
        }
    }

    public static function render_pro( array $profile, array $company, string $context ): void {
        extract( [ 'profile' => $profile, 'company' => $company, 'context' => $context ] );
        include __DIR__ . '/templates/profile-pro.php';
    }

    public static function render_standard( array $profile, array $company, string $context ): void {
        extract( [ 'profile' => $profile, 'company' => $company, 'context' => $context ] );
        include __DIR__ . '/templates/profile-standard.php';
    }

    /**
     * Emits a scoped <style> block for pro profile branding.
     * Use in the public context only — in preview, JS sets CSS vars via setProperty().
     */
    public static function render_design_style( int $profile_id, array $company ): void {
        if ( empty( $company['design'] ) ) return;
        $d     = $company['design'];
        $id    = (int) $profile_id;
        $scope = '.pro-profile-container.post-' . $id;
        ?>
        <style>
            <?php echo $scope; ?> {
                color: <?php echo esc_attr( $d['body_color'] ); ?>;
                font-family: <?php echo esc_attr( $d['body_font'] ); ?>;
            }
            <?php echo $scope; ?> h1,
            <?php echo $scope; ?> h2,
            <?php echo $scope; ?> h3,
            <?php echo $scope; ?> h4,
            <?php echo $scope; ?> h5,
            <?php echo $scope; ?> h6 {
                font-family: <?php echo esc_attr( $d['heading_font'] ); ?>;
                color: <?php echo esc_attr( $d['heading_color'] ); ?>;
            }
            <?php echo $scope; ?> :not(button) a {
                color: <?php echo esc_attr( $d['accent'] ); ?>;
            }
            <?php echo $scope; ?> button:not(.mecard-share-fab) {
                background-color: <?php echo esc_attr( $d['accent'] ); ?>;
                color: <?php echo esc_attr( $d['button_text'] ); ?>;
                border: 0;
            }
            #vcard-button-<?php echo $id; ?>.vcard-button {
                background-color: <?php echo esc_attr( $d['download'] ); ?>;
            }
            #vcard-button-<?php echo $id; ?>.vcard-button a {
                color: <?php echo esc_attr( $d['download_text'] ); ?>;
                font-family: <?php echo esc_attr( $d['body_font'] ); ?>;
                text-decoration: none;
            }
            <?php if ( ! empty( $company['custom_css'] ) ) echo self::scope_css( $company['custom_css'], $scope ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
        </style>
        <?php
    }

    /**
     * Prefixes every selector in a CSS string with $scope so rules don't bleed outside
     * the intended container. Handles simple rule sets; skips @-rules.
     */
    private static function scope_css( string $css, string $scope ): string {
        return preg_replace_callback(
            '/([^{}@]+)\{/',
            function ( $m ) use ( $scope ) {
                $selectors = array_filter( array_map( 'trim', explode( ',', $m[1] ) ) );
                $prefixed  = array_map( fn( $s ) => $scope . ' ' . $s, $selectors );
                return implode( ', ', $prefixed ) . ' {';
            },
            $css
        ) ?? $css;
    }
}
