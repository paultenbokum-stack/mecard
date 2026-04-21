(function ($) {
    function setSide(side) {
        $('.me-single-manage__card-toggle-btn')
            .removeClass('is-active')
            .attr('aria-selected', 'false');
        $('.me-single-manage__card-toggle-btn[data-card-side="' + side + '"]')
            .addClass('is-active')
            .attr('aria-selected', 'true');

        $('.me-single-manage__classic-pane').each(function () {
            var $pane = $(this);
            var active = $pane.data('card-preview') === side;
            $pane.toggleClass('is-active', active).prop('hidden', !active);
        });
    }

    $(function () {
        $('.me-single-manage__card-toggle-btn').on('click', function () {
            setSide($(this).data('card-side'));
        });
    });
})(jQuery);
