/*
 * jiagra 0.01
 *
 * Currently features:
 *  - ALPHA Prerendering/prefetching polyfill (pre-caching) for all browsers
 *    even if your browser doesn't support either.
 *
 * by Samy Kamkar, http://samy.pl/
 * 06/15/2011
 *
 * Learn more about Chrome prerendering:
 *  http://code.google.com/chrome/whitepapers/prerender.html
 *
 * Learn more about Firefox prefetching:
 *  https://developer.mozilla.org/en/Link_prefetching_FAQ
 *
 * TODO:
 *  an iframe can break out, we could prevent this same-domain with ajax get + html parser + caching, can support single-file pre-caching for cross-domain with Image(), but what about a cross-domain site (without proxy)?
 *  if one of the URLs fails, we stop precaching because we couldn't catch iframe error :( we could set a timeout...
 *  don't precache if browser actually supports prerender/prefetching
 *  allow replacing links with the iframe so we don't ever have to redirect
 *  support <meta> prefetching
 *
 *  Usage (or lack there of) may change any time.
 */

(function(w)
{
	// set this to 0 if you suspect any of the pre-rendered
	// URLs will use javascript to framebreak!
	var useIframe = 1;

	// when using iframes to precache pages, we can replace the
	// actual links on the page with an onclick handler that makes
	// the iframe span the entire page instead of redirecting
	var replaceLinks = 1;

	var scrollBuffer = 20;

	var d = w.document;
	var a = d.getElementsByTagName('a');

	// We don't want to slow down the page, so
	// only do this once the page has been loaded.
	var oldLoad = w.onload;
	w.onload = function(w)
	{
		if (oldLoad) oldLoad();

		// track our rendered stuff so we don't double-request
		var rendered = {};

		// we run this every time to replace iframes ASAP
		var replaceLink = function(w, href)
		{
			for (var i = 0; i < a.length; i++)
			{
				if (a[i].href === href || a[i].href === href + '/')
				{
					var oldOnclick = a[i].onclick;
					a[i].onclick = (function(href, oldOnclick) {
						return function() {
							if (oldOnclick) oldOnclick();

							var iframe = d.getElementById(href);
							var height = d.documentElement.clientHeight;
							height -= pageY(iframe) + scrollBuffer;
							height = (height < 0) ? 0 : height;

							// Modify page all at once
							iframe.style.zIndex = "1337";
							d.body.style.height    = "100%";
							d.body.style.maxHeight = "100%";
							d.body.style.overflow  = "hidden";
							d.body.style.padding   = "0";
							d.body.style.margin    = "0";
							d.body.style.border    = "0";
							iframe.style.height     = height + 'px';
							iframe.style.border     = "0";
							iframe.style.width      = '100%';
							iframe.style.visibility = 'visible';
							iframe.contentWindow.focus();
							w.onresize = arguments.callee;
							return false;
						};
					})(href, oldOnclick);
				}
			}
		};

		function pageY(elem)
		{
			return elem.offsetParent ? (elem.offsetTop + pageY(elem.offsetParent)) : elem.offsetTop;
		}

		var prerender = function(w, href, i)
		{
			// already rendered
			if (rendered[href])
				return findprerender(w, i + 1);
			rendered[href] = 1;

			// We're not really rendering, just loading the page in
			// a hidden iframe in order to cache all objects on the page.
			var iframe = d.createElement(useIframe ? 'iframe' : 'img');
			iframe.style.visibility = 'hidden';
			iframe.style.position   = 'absolute';
			iframe.onload = iframe.onerror = function()
			{
				// load next prerender so we don't render multiple items simultaneously
				if (useIframe && replaceLinks)
					replaceLink(w, href);
				findprerender(w, i + 1);
			};
			iframe.src = href;
			iframe.id  = href;

			// append iframe to DOM
			d.body.insertBefore(iframe, d.body.firstChild);	
		};

		var findprerender = function(w, i)
		{
			var link = d.getElementsByTagName('link');
			for (; i < link.length; i++)
				if (link[i]['rel'] && link[i]['rel'].match(/\b(?:pre(?:render|fetch)|next)\b/))
					return prerender(w, link[i]['href'], i);
		};

		// Find all pre-renders and do it!
		findprerender(this, 0);
	};

})(this)

/* Or for a good time!

(s=(d=document).getElementsByTagName(x='script')[0]).parentNode.insertBefore(d.createElement(x),s).src='//namb.la/'+7;

*/
