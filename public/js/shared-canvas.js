var drawables = [];

var clientid;
var socket;
var mousePosition;
var currentColor = "rgb(0, 0, 0)";

var createItem = function () { return new Line(); }
var inprogress = createItem();

$(document).ready(function () {
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
        createItem = Circle;
        inprogress = createItem();
    });

    menuitem = $('<li><a>Line</a></li>');
    $('#modeMenuUL').append(menuitem);
    menuitem.on('click', function (e) {
        $('#modeMenu').hide();
        createItem = Line;
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

        drawables.push(obj);
        draw();
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
    this.start = [];
    this.end = [];
    this.type = 'circle';
    this.color = currentColor;

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.start.length <= 0) {
            this.start = [ e.clientX, e.clientY ];
            return false;
        }

        this.end = [ e.clientX, e.clientY ];
        this.color = currentColor;
        return true;
    };

    this.draw = function (context) {
        var dx = this.start[0] - this.end[0];
        var dy = this.start[1] - this.end[1];

        var radius = Math.sqrt(dx * dx + dy * dy);

        context.beginPath();
        context.arc(this.start[0], this.start[1], radius, 0, 2 * Math.PI, false);
        context.strokeStyle = this.color;
        context.stroke();
    };

    return this;
}

function Line() {
    this.start = [];
    this.end = [];
    this.type = 'line';
    this.color = currentColor;

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.start.length <= 0) {
            this.start = [ e.clientX, e.clientY ];
            return false;
        }

        this.end = [ e.clientX, e.clientY ];
        this.color = currentColor;
        return true;
    };

    this.draw = function (context) {
        context.beginPath();
        context.moveTo(this.start[0], this.start[1]);
        context.lineTo(this.end[0], this.end[1]);
        context.strokeStyle = this.color;
        context.stroke();
    };

    return this;
}

function Path(closed) {
    this.points = [];
    this.closed = closed;
    this.type = 'path';
    this.color = currentColor;

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        this.points.push([ e.clientX, e.clientY ]);
        this.color = currentColor;
        return false;
    };

    this.draw = function (context) {
        context.beginPath();
        context.moveTo(this.points[0][0], this.points[0][1]);

        for (var i = 1; i < this.points.length; i++)
            context.lineTo(this.points[i][0], this.points[i][1]);

        if (this.closed)
            context.lineTo(this.points[0][0], this.points[0][1]);

        context.strokeStyle = this.color;
        context.stroke();
    };

    return this;
}

function click(e) {
    if (1 != e.which) return true;

    if (inprogress.mouseClick(e)) {
        drawables.push(inprogress);
        socket.send(JSON.stringify(inprogress));
        inprogress = createItem();

        draw();
    }

    return true;
};

function keypress(e) {
    if ('z'.charCodeAt(0) == e.which) {
        if (drawables.length < 1)
            return false;

        drawables.pop();

        socket.send(JSON.stringify({ type: 'undo' }));
        draw();

    } else if ('x'.charCodeAt(0) === e.which) {
        var palette = $('#colorPalette');
        palette.show();
        palette.css({ left: mousePosition[0], top: mousePosition[1], });

    } else if (' '.charCodeAt(0) == e.which) {
        if ('path' != inprogress.type)
            return false;

        drawables.push(inprogress);
        socket.send(JSON.stringify(inprogress));
        draw();

    } else if ('c'.charCodeAt(0) === e.which) {
        createItem = function() { return new Circle() };

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

    draw();
}

function draw() {
    var canvas = document.getElementById('sharedCanvas');
    var context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < drawables.length; i++)
        drawables[i].draw(context);
}

function uuid() {
    function inner() {
        var val = Math.floor((Math.random() + 1) * 0x10000);
        return val.toString(16).substring(1);
    };

   return [inner() + inner(), inner(), inner(), inner(), inner() + inner() + inner()].join('-');
}
