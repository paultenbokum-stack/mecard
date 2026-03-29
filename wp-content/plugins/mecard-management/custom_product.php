<?php

define( 'MECARD_SALE_START', '2025-10-26' );   // YYYY-MM-DD
define( 'MECARD_SALE_END',   '2025-11-02' );   // YYYY-MM-DD
define( 'MECARD_SALE_PERCENT', 20 );            // Discount percent (e.g., 20 = 20%)
define( 'MECARD_REGULAR_PRICE', 199 );          // Regular product price

add_action('woocommerce_init', 'load_profile_as_product');

function load_profile_as_product() {

    class WC_Product_Profile extends WC_Product  {

        protected $post_type = 'mecard-profile';

        public function get_type() {
            return 'mecard-profile';
        }

        public function __construct( $product = 0 ) {
            $this->supports[]   = 'ajax_add_to_cart';

            parent::__construct( $product );


        }
        // maybe overwrite other functions from WC_Product

    }

    class MPP_Data_Store_CPT extends WC_Product_Data_Store_CPT {

        public function read( &$product ) { // this is required
            $product->set_defaults();
            $post_object = get_post( $product->get_id() );

            if ( ! $product->get_id() || ! $post_object || 'mecard-profile' !== $post_object->post_type ) {

                throw new Exception( __( 'Invalid product.', 'woocommerce' ) );
            }
            //$product->set_downloadable(true);
            $product->set_virtual(true);
            $product->set_props(
                array(
                    'name'              => 'Profile Upgrade: '.$post_object->post_title,
                    'slug'              => $post_object->post_name,
                    'date_created'      => 0 < $post_object->post_date_gmt ? wc_string_to_timestamp( $post_object->post_date_gmt ) : null,
                    'date_modified'     => 0 < $post_object->post_modified_gmt ? wc_string_to_timestamp( $post_object->post_modified_gmt ) : null,
                    'status'            => $post_object->post_status,
                    'description'       => $post_object->post_content,
                    'short_description' => $post_object->post_excerpt,
                    'parent_id'         => $post_object->post_parent,
                    'menu_order'        => $post_object->menu_order,
                    'reviews_allowed'   => 'open' === $post_object->comment_status,
                )
            );

            $this->read_attributes( $product );
            $this->read_downloads( $product );
            $this->read_visibility( $product );
            $this->read_product_data( $product );
            $this->read_extra_data( $product );
            $product->set_object_read( true );
        }

        // maybe overwrite other functions from WC_Product_Data_Store_CPT

    }


    class MPP_WC_Order_Item_Product extends WC_Order_Item_Product {
        public function set_product_id( $value ) {
            if ( $value > 0 && 'mecard-profile' !== get_post_type( absint( $value ) ) ) {
                $this->error( 'order_item_product_invalid_product_id', __( 'Invalid product ID', 'woocommerce' ) );
            }
            $this->set_prop( 'product_id', absint( $value ) );
        }

    }


}





function MPP_woocommerce_data_stores( $stores ) {
    // the search is made for product-$post_type so note the required 'product-' in key name
    $stores['product-mecard-profile'] = 'MPP_Data_Store_CPT';
    return $stores;
}
add_filter( 'woocommerce_data_stores', 'MPP_woocommerce_data_stores' , 11, 1 );


function WC_Product_Profile_class( $class_name ,  $product_type ,  $product_id ) {
    if ($product_type == 'mecard-profile')
        $class_name = 'WC_Product_Profile';
    return $class_name;
}
add_filter('woocommerce_product_class','WC_Product_Profile_class',25,3 );



//function my_woocommerce_product_get_price( $price, $product ) {
//
//    if ($product->get_type() == 'mecard-profile' ) {
//        $price = 199;  // or get price how ever you see fit
//    }
//    return $price;
//}
//add_filter('woocommerce_get_price','my_woocommerce_product_get_price',20,2);
//add_filter('woocommerce_product_get_price', 'my_woocommerce_product_get_price', 10, 2 );

// === Dynamic Sale Pricing for MeCard Custom Product ===
add_filter( 'woocommerce_product_get_price', 'mecard_profile_dynamic_sale_price', 10, 2 );
add_filter( 'woocommerce_product_get_regular_price', 'mecard_profile_dynamic_regular_price', 10, 2 );
add_filter( 'woocommerce_product_is_on_sale', 'mecard_profile_dynamic_is_on_sale', 10, 2 );

function mecard_profile_dynamic_regular_price( $price, $product ) {
    if ( $product->get_type() === 'mecard-profile' ) {
        $price = MECARD_REGULAR_PRICE;
    }
    return $price;
}

function mecard_profile_dynamic_sale_price( $price, $product ) {
    if ( $product->get_type() === 'mecard-profile' ) {
        $regular = MECARD_REGULAR_PRICE;
        $start = strtotime( MECARD_SALE_START );
        $end   = strtotime( MECARD_SALE_END );
        $now   = current_time( 'timestamp' );

        if ( $now >= $start && $now <= $end ) {
            $discount = MECARD_SALE_PERCENT / 100;
            return round( $regular * ( 1 - $discount ), 2 );
        }

        return $regular;
    }
    return $price;
}

function mecard_profile_dynamic_is_on_sale( $on_sale, $product ) {
    if ( $product->get_type() === 'mecard-profile' ) {
        $start = strtotime( MECARD_SALE_START );
        $end   = strtotime( MECARD_SALE_END );
        $now   = current_time( 'timestamp' );
        return ( $now >= $start && $now <= $end );
    }
    return $on_sale;
}


// required function for allowing posty_type to be added; maybe not the best but it works
function WC_Product_Profile_type($false,$product_id) {
    if ($false === false) { // don't know why, but this is how woo does it
        global $post;
        // maybe redo it someday?!
        if (is_object($post) && !empty($post)) { // post is set
            if ($post->post_type == 'mecard-profile' && $post->ID == $product_id)
                return 'mecard-profile';
            else {
                $product = get_post( $product_id );
                if (is_object($product) && !is_wp_error($product)) { // post not set but it's a mecard-profile
                    if ($product->post_type == 'mecard-profile')
                        return 'mecard-profile';
                } // end if
            }

        } else if(wp_doing_ajax()) { // has post set (usefull when adding using ajax)
            $product_post = get_post( $product_id );
            if ($product_post->post_type == 'mecard-profile')
                return 'mecard-profile';
        } else {
            $product = get_post( $product_id );
            if (is_object($product) && !is_wp_error($product)) { // post not set but it's a mecard-profile
                if ($product->post_type == 'mecard-profile')
                    return 'mecard-profile';
            } // end if

        } // end if  // end if



    } // end if
    return false;
}
add_filter('woocommerce_product_type_query','WC_Product_Profile_type',12,2 );

function MPP_woocommerce_checkout_create_order_line_item_object($item, $cart_item_key, $values, $order) {

    $product = $values['data'];
    if ($product->get_type() == 'mecard-profile') {
        return new MPP_WC_Order_Item_Product();
    } // end if
    return $item ;
}
add_filter( 'woocommerce_checkout_create_order_line_item_object', 'MPP_woocommerce_checkout_create_order_line_item_object', 20, 4 );

function cod_woocommerce_checkout_create_order_line_item($item,$cart_item_key,$values,$order) {
    if ($values['data']->get_type() == 'mecard-profile') {
        $item->update_meta_data( '_mecard-profile', 'yes' ); // add a way to recognize custom post type in ordered items
        return;
    } // end if

}
add_action( 'woocommerce_checkout_create_order_line_item', 'cod_woocommerce_checkout_create_order_line_item', 20, 4 );

function MPP_woocommerce_get_order_item_classname($classname, $item_type, $id) {
    global $wpdb;
    $is_MPP = $wpdb->get_var("SELECT meta_value FROM {$wpdb->prefix}woocommerce_order_itemmeta WHERE order_item_id = {$id} AND meta_key = '_mecard-profile'");


    if ('yes' === $is_MPP) { // load the new class if the item is our custom post
        $classname = 'MPP_WC_Order_Item_Product';
    } // end if
    return $classname;
}
add_filter( 'woocommerce_get_order_item_classname', 'MPP_woocommerce_get_order_item_classname', 20, 3 );

