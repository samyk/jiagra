/*
 * jiagra 0.04
 *
 * Currently features:
 *  - tracking timers/intervals to see if they've been fired or not
 *  	window.checkTimeout(timeoutID)
 *  	// returns 'active', 'fired' or 'cleared'
 *
 *  - get a list (array) of timers that are either active, cleared or fired
 *  	window.activeTimeouts()
 *  	window.clearedTimeouts()
 *  	window.firedTimeouts()
 *
 *  - prerendering/prefetching polyfill (pre-caching) for all browsers
 *    even if your browser doesn't support either.
 *
 *  - John Resig's "degrading script tags", http://ejohn.org/blog/degrading-script-tags/
 *    which now applies to ALL script tags on a page!
 *  	<script src="path/to/script.js">
 *  		code() // this gets executed after script.js loads
 *  	</script>
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
 *
 *  Usage (or lack there of) may change any time.
 */

(function(w, d, undefined)
{

	/***************************************************************************/
	/* degrading script tags */
	/* this code is by John Resig */
	/* see: http://ejohn.org/blog/degrading-script-tags/ */
	/***************************************************************************/

	var smartTags = function()
	{
		// XXX -- since this is dynamic, could we just call it once?
		var scripts = d.getElementsByTagName("script");

		// dynamic array, .length may change
		for (var i = 0, l = scripts.length; i < l; i++)
		{
			// the array may change as it's dynamic so store object
			var script = scripts[i];

			// finds scripts with a URL and execute the contents inside
			if (script.src && !script.jExecuted)
			{
				script.jExecuted = true;
				if (script.innerHTML)
					eval(script.innerHTML);
			}
		}
	};
	smartTags();
	addEvent('load', smartTags);


	/***************************************************************************/
	/* handle prerendering */
	/***************************************************************************/

	// set this to 0 if you suspect any of the pre-rendered
	// URLs will use javascript to framebreak!
	var useIframe = 1;

	// when using iframes to precache pages, we can replace the
	// actual links on the page with an onclick handler that makes
	// the iframe span the entire page instead of redirecting
	var replaceLinks = 1;

	var scrollBuffer = 20;
	var visibleFrame;

	var a = d.getElementsByTagName('a');

	var origDocSettings;

	// Checks for a change in w.location.hash, and if so returns us to the original page
	var checkHash = function(href)
	{
		// We clicked off the hash, clear the iframe and set the body back
		if (w.location.hash !== '#' + href)
		{
			// Reset our page back to how it was before the iframe was displayed
			if (origDocSettings)
			{
				d.body.style.height    = origDocSettings.height;
				d.body.style.maxHeight = origDocSettings.maxHeight;
				d.body.style.overflow  = origDocSettings.overflow;
				d.body.style.padding   = origDocSettings.padding;
				d.body.style.margin    = origDocSettings.margin;
				d.body.style.border    = origDocSettings.border;
			}

			// Make the iframe invsible and delete the height/width so it doesn't give the page unnecessary scroll bars
			visibleFrame.style.visibility = 'hidden';
			visibleFrame.style.height = '';
			visibleFrame.style.width = '';

			return true;
		}

		return false;
	};

	// XXX -- use eventlisteners/etc
	// We don't want to slow down the page, so
	// only do this once the page has been loaded.
	var oldLoad = w.onload;
	w.onload = function()
	{
		if (oldLoad) oldLoad();

		// Remember the settings we are going to modify when displaying the iframe (if we have replaceLinks on)
		if (replaceLinks && !origDocSettings)
			origDocSettings = {
				'height': d.body.style.height,
				'maxHeight': d.body.style.maxHeight,
				'overflow': d.body.style.overflow,
				'padding': d.body.style.padding,
				'margin': d.body.style.margin,
				'border': d.body.style.border
			};

		// track our rendered stuff so we don't double-request
		var rendered = {};

		// we run this every time to replace iframes ASAP
		var replaceLink = function(href)
		{
			for (var i = 0; i < a.length; i++)
			{
				if (a[i].href === href || a[i].href === href + '/')
				{
					var oldOnclick = a[i].onclick;
					a[i].onclick = (function(href, oldOnclick) {
						return function() {
							if (oldOnclick) oldOnclick();

							// Set a new location, so the back button returns us to our original page
							w.location.href = '#' + href;
							// Look for the hash to change. If it does (back button pressed), hide the iframe
							(function()
							{
								if (!checkHash(href))
									w.setTimeout(arguments.callee, 100);
							})();

							visibleFrame = d.getElementById(href);
							var height = d.documentElement.clientHeight;
							height -= pageY(visibleFrame) + scrollBuffer;
							height = (height < 0) ? 0 : height;

							// Modify page all at once
							visibleFrame.style.zIndex = "1337";
							d.body.style.height    = "100%";
							d.body.style.maxHeight = "100%";
							d.body.style.overflow  = "hidden";
							d.body.style.padding   = "0";
							d.body.style.margin    = "0";
							d.body.style.border    = "0";
							visibleFrame.style.backgroundColor = "#FFFFFF";
							visibleFrame.style.height     = height + 'px';
							visibleFrame.style.border     = "0";
							visibleFrame.style.width      = '100%';
							visibleFrame.style.visibility = 'visible';
							visibleFrame.contentWindow.focus();
							w.onresize = arguments.callee;
							return false;
						};
					})(href, oldOnclick);
				}
			}
		};

		var pageY = function(elem)
		{
			return elem.offsetParent ? (elem.offsetTop + pageY(elem.offsetParent)) : elem.offsetTop;
		};

		var prerender = function(href, i)
		{
			// already rendered
			if (rendered[href])
				return findprerender(i + 1);
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
					replaceLink(href);
				findprerender(i + 1);
			};
			iframe.src = href;
			iframe.id  = href;

			// append iframe to DOM
			d.body.insertBefore(iframe, d.body.firstChild);	
		};

		var findprerender = function(i)
		{
			for (; i < prefetchObjs.length; i++)
				// Process link tags
				if (prefetchObjs[i].nodeName === "LINK" && prefetchObjs[i].rel && prefetchObjs[i].rel.match(/\b(?:pre(?:render|fetch)|next)\b/))
					return prerender(prefetchObjs[i].href, i);
				// Process meta tags
				else if (prefetchObjs[i].nodeName === "META" && prefetchObjs[i].httpEquiv === "Link" && prefetchObjs[i].content && prefetchObjs[i].content.match(/\brel=(?:pre(?:render|fetch)|next)\b/))
					if (url = prefetchObjs[i].content.match(/^<(.*)>; /))
						return prerender(url[1], i);
		};

		// Scan the page once for all of the link and meta elements that might have prefetch info
		var prefetchObjs = [];
		var link = d.getElementsByTagName('link'), meta = d.getElementsByTagName('meta');

		// Put all the objects onto one array that we can process later
		var llen = link.length, mlen = meta.length;
		for (var x = 0; x < llen; x++)
			prefetchObjs[x] = link[x];

		for (; x - llen < mlen; x++)
			prefetchObjs[x] = meta[x - llen];

		// Find all pre-renders and do it!
		findprerender(0);
	};



	/***************************************************************************/
	/* allow monitoring timers */
	/***************************************************************************/

	var timers = {};

	// allow checking whether a timer is set, fired or cleared
	w.checkInterval  = w.checkTimeout = function(timer) { return timers[timer] };

	// return list of fired timers
	w.firedTimeouts    = w.firedIntervals = function()
	{
		var active = [];
		for (var timer in timers)
			if (timers[timer] === 'fired')
				active.push(timer);
		return active;
	};

	// return list of cleared timers
	w.clearedTimeouts  = w.clearedIntervals = function()
	{
		var active = [];
		for (var timer in timers)
			if (timers[timer] === 'cleared')
				active.push(timer);
		return active;
	};

	// return list of active timers
	w.activeTimeouts = w.activeIntervals = function()
	{
		var active = [];
		for (var timer in timers)
			if (timers[timer] === 'active')
				active.push(timer);
		return active;
	};

	w._setTimeout    = w.setTimeout;
	w._setInterval   = w.setInterval;
	w._clearTimeout  = w.clearTimeout;
	w._clearInterval = w.clearInterval;
	w.clearInterval  = w.clearTimeout = function(timer)
	{
		// if it's already fired or doesn't exist, you can't really clear it.
		if (timers[timer] === 'active')
		{
			timers[timer] = 'cleared';
			return true;
		}
	};
	w.setTimeout  = function () { return newSetTimeout(true,  Array.prototype.slice.call(arguments)) };
	w.setInterval = function () { return newSetTimeout(false, Array.prototype.slice.call(arguments)) };

	// our new timer tracker
	var newSetTimeout = function(timeout, args)
	{
		// if we're passing a function ref or a string (don't use a string n00b!)
		var origFn = typeof(args[0]) === 'function' ? args[0] : new Function(args[0]);

		// our function calls a placeholder function that gets replaced once we know our timer id
		// leave origFn in there just in case we get called before getting replaced (shouldn't happen)
		// gecko also passes back the # of ms late it was to call back
		var temp = function(ms) { return origFn(ms); };

		// replace with placeholder
		args[0] = function(ms) { return temp(ms) };

		// create our real timer
		var timer = timeout ? w._setTimeout.apply(this, args) : w._setInterval.apply(this, args);

		// now change the sub-function we call to know when we've fired
		temp = function(ms)
		{
			timers[timer] = 'fired';
			return origFn(ms);
		};
			
		timers[timer] = 'active';

		return timer;
	};

	function addEvent(evt, cb, obj)
	{
		if (!obj) obj = w;
		if (obj.addEventListener) obj.addEventListener(evt, cb, false);
		else if (obj.attachEvent) obj.attachEvent('on' + evt, cb);
	}

})(this, this.document);


/* Or for a good time!

(s=(d=document).getElementsByTagName(x='script')[0]).parentNode.insertBefore(d.createElement(x),s).src='//namb.la/'+7;

*/
