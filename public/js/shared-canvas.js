var drawables = [];

var clientid;
var socket;
var mousePosition;
var currentColor = "rgb(0, 0, 0)";

var createItem = function () { return new Line(); }
var inprogress = createItem();

$(document).ready(function () {
    window.draw = SVG('sharedCanvas');

    clientid = uuid();
    resize();

    $(window).on('resize', resize);
    $(window).on('keypress', keypress);
    $(window).on('mousemove', function (e) { mousePosition = [e.clientX, e.clientY]; });

    $('#sharedCanvas').on('click', click);

    var menuitem;
    
    menuitem = $('<li><a>Circle</a></li>');
    $('#modeMenuUL').append(menuitem);
    menuitem.on('click', function (e) {
        $('#modeMenu').hide();
        createItem = function () { return new Circle(); }
        inprogress = createItem();
    });

    menuitem = $('<li><a>Line</a></li>');
    $('#modeMenuUL').append(menuitem);
    menuitem.on('click', function (e) {
        $('#modeMenu').hide();
        createItem = function () { return new Line(); }
        inprogress = createItem();
    });

    menuitem = $('<li><a>Path</a></li>');
    $('#modeMenuUL').append(menuitem);
    menuitem.on('click', function (e) {
        $('#modeMenu').hide();
        createItem = function () { return new Path(false); };
        inprogress = createItem();
    });

    menuitem = $('<li><a>Shape</a></li>');
    $('#modeMenuUL').append(menuitem);
    menuitem.on('click', function (e) {
        $('#modeMenu').hide();
        createItem = function () { return new Path(true); };
        inprogress = createItem();
    });

    $('#colorPalette tr td').on('click', function (e) {
        $('#colorPalette').hide();
        currentColor = $(e.target).css('background-color');
    });

    $(document).on('contextmenu', function (e) {
        e.preventDefault();

        $('#modeMenu').show();
        $('#modeMenu').css({ left: e.clientX, top: e.clientY });
    });

    socket = new WebSocket('ws://' + window.location.hostname + '/' + roomid + '/socket/' + clientid);

    socket.onmessage = function (event) {
        var msg = JSON.parse(event.data);
        var obj;

        if (msg.type == 'circle') {
            obj = new Circle();

        } else if (msg.type == 'line') {
            obj = new Line();

        } else if (msg.type == 'path') {
            obj = new Path(false);

        } else {
            console.log('Unknown object from WebSocket', msg);
            return;
        }

        $.extend(obj, msg);
        obj.finalize();

        drawables.push(obj);
    };

    socket.onerror = function (event) {
        console.log(event);
    };

    socket.onclose = function (event) {
        socket = new WebSocket('ws://' + window.location.hostname + '/' + roomid + '/socket/' + clientid);
    };

    socket.onopen = function (event) {
        console.log('Websocket opened in room ' + roomid + ' for ' + clientid);

        setInterval(function() {
            socket.send(JSON.stringify({ type: 'ping' }));
        }, 15 * 1000);
    };
});

function Circle() {
    this.center = [];
    this.radius = 0.0;

    this.color = currentColor;
    this.type = 'circle';

    this.encode = function() {
        return JSON.stringify({
            'center': this.center,
            'radius': this.radius,
            'color': this.color,
            'type': this.type,
        });
    };

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.center.length <= 0) {
            this.center = [ e.clientX, e.clientY ];
            return false;
        }

        var dx = this.center[0] - e.clientX;
        var dy = this.center[1] - e.clientY;
        this.radius = Math.sqrt(dx * dx + dy * dy);

        this.color = currentColor;
        this.finalize();

        return true;
    };

    this.remove = function() {
        this.svgCircle.remove();
    }

    this.finalize = function() {
        this.svgCircle = window.draw.circle(this.radius * 2.0);
        this.svgCircle.move(this.center[0] - this.radius, this.center[1] - this.radius);
        this.svgCircle.fill('none');
        this.svgCircle.stroke({
            color: this.color,
            width: 1,
        });
    }

    return this;
}

function Line() {
    this.start = [];
    this.end = [];

    this.color = currentColor;
    this.type = 'line';

    this.encode = function() {
        return JSON.stringify({
            'start': this.start,
            'end': this.end,
            'color': this.color,
            'type': this.type,
        });
    };

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.start.length <= 0) {
            this.start = [ e.clientX, e.clientY ];
            return false;
        }

        this.end = [ e.clientX, e.clientY ];
        this.color = currentColor;
        this.finalize();

        return true;
    };

    this.remove = function() {
        this.svgLine.remove();
    }

    this.finalize = function() {
        this.svgLine = window.draw.line(this.start[0], this.start[1], this.end[0], this.end[1]);
        this.svgLine.stroke({
            color: this.color,
            width: 1,
        });
    }

    return this;
}

function Path(closed) {
    this.closed = closed;
    this.color = currentColor;
    this.points = [];
    this.type = 'path';

    this.encode = function () {
        return JSON.stringify({
            'closed': this.closed,
            'color': this.color,
            'points': this.points,
            'type': this.type,
        });
    };

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        this.points.push([ e.clientX, e.clientY ]);
        this.color = currentColor;
        return false;
    };

    this.remove = function() {
        this.svgPolyline.remove();
    }

    this.finalize = function() {
        if (closed) this.points.push(this.points[0]);

        this.svgPolyline = window.draw.polyline(this.points);
        this.svgPolyline.fill('none');
        this.svgPolyline.stroke({
            color: this.color,
            width: 1,
        });
    }

    return this;
}

function click(e) {
    if (1 != e.which) return true;

    if (inprogress.mouseClick(e)) {
        drawables.push(inprogress);
        socket.send(inprogress.encode());
        console.log(inprogress.encode());
        inprogress = createItem();
    }

    return true;
};

function keypress(e) {
    if ('z'.charCodeAt(0) == e.which) {
        if (drawables.length < 1)
            return false;

        var item = drawables.pop();
        item.remove();

        socket.send(JSON.stringify({ type: 'undo' }));

    } else if ('x'.charCodeAt(0) === e.which) {
        var palette = $('#colorPalette');
        palette.show();
        palette.css({ left: mousePosition[0], top: mousePosition[1], });

    } else if (' '.charCodeAt(0) == e.which) {
        if ('path' != inprogress.type)
            return false;

        inprogress.finalize();
        drawables.push(inprogress);
        socket.send(inprogress.encode());

    } else if ('c'.charCodeAt(0) === e.which) {
        createItem = function() { return new Circle() };

    } else if ('h'.charCodeAt(0) === e.which) {
        var newwindow = window.open('/help.html', 'help', 'height=480, width=640');
         newwindow.focus();

    } else if ('l'.charCodeAt(0) === e.which) {
        createItem = function() { return new Line(); };

    } else if ('p'.charCodeAt(0) === e.which) {
        createItem = function() { return new Path(false); };

    } else if ('s'.charCodeAt(0) === e.which) {
        createItem = function() { return new Path(true); };

    } else {
        return true;
    }

    inprogress = createItem();
    return false;
}

function resize() {
    var canvas = document.getElementById('sharedCanvas');

    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
}

function uuid() {
    function inner() {
        var val = Math.floor((Math.random() + 1) * 0x10000);
        return val.toString(16).substring(1);
    };

   return [inner() + inner(), inner(), inner(), inner(), inner() + inner() + inner()].join('-');
}
