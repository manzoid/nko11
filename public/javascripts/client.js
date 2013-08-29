if (window['console']) {
  console.log('Kilroy was here');
}

(function($) {
  $(document).ready(function(){
    $('#show-form').click(function(){
      $('#show-form').fadeOut('fast', function(){
        $('#hidden-form').slideDown('slow');  
      });
    });  
  });
})(jQuery);