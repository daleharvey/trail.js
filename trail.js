Trail.Router = (function() {

  var PATH_MATCHER = /:([\w\d]+)/g;
  var PATH_REPLACER = "([^\/]+)";

  var WILD_MATCHER = /\*([\w\d]+)/g;
  var WILD_REPLACER = "(.*?)";

  var preRouteHook;

  var lastRoute;
  var history = [];

  var routes = {
    GET: [],
    POST: []
  };


  // I would like this namespaced, but hashchange needs to be bound to window
  function init() {
    $(window).bind('hashchange', hashChanged).trigger('hashchange');
    $(window).bind('submit', formSubmitted);
  }

  // Triggered by hashchange events, starts new routing process
  function hashChanged() {
    var url = "#" + (document.location.hash.slice(1) || "");
    history.push(url);
    trigger("GET", url);
  }


  // Triggered by form submission, starts new routing process if the form
  // action is 'routable' (starts with a #)
  function formSubmitted(e) {

    var action = e.target.getAttribute('action');

    if (action[0] === '#') {
      e.preventDefault();
      trigger('POST', action, e, serialize(e.target));
    }
  }


  // Define a function that is executed prior to any invoking a route, if the
  // fun returns false it will cancel the route invokation
  function pre(fun) {
    preRouteHook = fun;
  }


  // Provide a fun to be called
  function get(path, context, fun) {
    routes.GET.push({
      rePath: toRegex(path),
      path: path,
      context: context,
      fun: fun
    });
  }


  function post(path, context, fun) {
    routes.POST.push({
      rePath: toRegex(path),
      path: path,
      context: context,
      fun: fun
    });
  }


  // If the path definition is a string, expand to a regular expression
  function toRegex(path) {
    if (path.constructor == String) {
      var regex = '^' + path.replace(PATH_MATCHER, PATH_REPLACER)
        .replace(WILD_MATCHER, WILD_REPLACER) + '$';
      return new RegExp(regex);
    } else {
      return path;
    }
  }


  // This is where everything happens
  function trigger(verb, url, evt, data) {

    var routeObj = matchPath(verb, url);

    // If there isnt a match we do nothing, if the user wants a 404 they can
    // just add a catchall route
    if (routeObj) {

      var args = [];

      if (verb === 'POST') {
        args.unshift(data);
        args.unshift(evt);
      }

      // If the route we are leaving has provided a teardown callback
      // then run it
      if (verb === 'GET' && lastRoute && lastRoute.context.unload) {
        lastRoute.context.unload.apply(lastRoute.context, []);
      }

      // prefun allows the user to provide a function to that can
      // validate the request and cancel if needed (authorisation for example)
      // it would probably be better to do webmachine / cgi style routing, but
      // this works for now
      if (preRouteHook && preRouteHook(routeObj) === false) {
        return;
      }

      routeObj.fun.apply(routeObj.context, args);

      if (verb === 'GET') {
        lastRoute = routeObj;
      }
    }
  }


  // loop through the routes and find the first that matches current path
  function matchPath(verb, path) {
    for (var i = 0; i < routes[verb].length; i++) {
      var routeObj = routes[verb][i];
      if (path.match(routeObj.rePath)) {
        return routeObj;
      }
    }
    return false;
  }


  // Serialize the form results into an object
  function serialize(obj) {
    var o = {};
    var a = $(obj).serializeArray();
    $.each(a, function() {
      if (o[this.name]) {
        if (!o[this.name].push) {
          o[this.name] = [o[this.name]];
        }
        o[this.name].push(this.value || '');
      } else {
        o[this.name] = this.value || '';
      }
    });
    return o;
  }


  return {
    refresh: hashChanged,
    pre: pre,
    get: get,
    post: post,
    init: init
  };

})();


// This I hacked together pretty quickly after seeing the ember views,
// the view inheritance I am no so sure about and the extend method is
// most definitely ugly
Trail.View = (function() {


  this.data = {};


  this.render = function(opts) {

    opts = opts || {};

    if (this.parent) {
      this.parent.render(opts);
    }

    var tplData = $.extend({}, this.data, opts.data || {});
    var source = $('#' + this.template + '-tpl').html();
    var data = Handlebars.compile(source)(tplData);

    if (this.preRender) {
      if (this.preRender() === false) {
        return;
      }
    }

    if (this.container) {
      $(this.container).empty().append(data);
    }

    if (this.postRender) {
      this.postRender();
    }
    currentView = this;

    return data;
  };


  this.extend = function(obj) {
    return $.extend({}, this, obj);
  };


  return {
    data: this.data,
    extend: this.extend,
    render: this.render
  };

})();