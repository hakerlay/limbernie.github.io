var max_width = 768;
var em = 16;
var btt = $('.back-to-top');
var sb  = $('.sidebar');
var mn  = $('.menu');
var btn = $('.btn');
var ph  = $('.post-header');
var fi  = $('.feature-image');
var no  = $('.notice');
var ol   = $('.overlay');

$(document).ready(function() {
	var width = $(window).width();
	backToTop(width);

	mn.click(function() {
		toggle();
	});
});

$(window).resize(debounce(function() {
	var width = $(window).width();
	backToTop(width);
	if (sb.css('display') == 'none') sb.removeAttr('style');
}, 500));

function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

function backToTop(width) {
	var offset = 65
				 + sb.outerHeight(true)
				 + ph.outerHeight(true)
				 + btn.outerHeight(true);

	if ( fi.length ) offset += fi.outerHeight(true);
	if ( no.length ) offset += no.outerHeight(true);

	if (width < max_width) {
		var threshold = Math.ceil(offset);
		$(window).scroll(function() {
			if ($(this).scrollTop() > threshold) {
				btt.show();
			} else {
				btt.hide();
			}
		});
		btt.click(function() {
			$('html, body').animate({
				scrollTop: 0},
				'slow',
				function() { $(this).finish(); });
		});
	} else {
		$(window).scroll(function() {
			btt.hide();
		});
	}
}

function toggle() {
	sb.toggle('slide', 'slow');
	blind();
}

function blind() {
	if (ol.css('visibility') == 'hidden')
		ol.css({'visibility':'visible','opacity':0.0}).animate({'opacity':1.0}, 'slow');
	else
		ol.css({'visibility':'hidden','opacity':1.0}).animate({'opacity':0.0}, 'slow');
}
