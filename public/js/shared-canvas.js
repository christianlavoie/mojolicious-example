var drawables = [];

var inprogress = new Line();

var clientid;
var socket;

var Item = Line;

$(document).ready(function () {
    clientid = uuid();
    resize();

    $(window).on('resize', resize);
    $('#sharedCanvas').on('click', click);

    var menuitem;
    
    menuitem = $('<li><a>Line</a></li>');
    $('#modeMenuUL').append(menuitem);
    menuitem.on('click', function (e) {
        $('#modeMenu').hide();
        Item = Line;
        inprogress = new Line();
    });

    menuitem = $('<li><a>Circle</a></li>');
    $('#modeMenuUL').append(menuitem);
    menuitem.on('click', function (e) {
        $('#modeMenu').hide();
        Item = Circle;
        inprogress = new Circle();
    });

    $(document).on('contextmenu', function (e) {
        e.preventDefault();

        $('#modeMenu').show();
        $('#modeMenu').offset({ left: e.clientX, top: e.clientY});
    });

    socket = new WebSocket('ws://' + window.location.hostname + '/' + roomid + '/socket/' + clientid);

    socket.onmessage = function (event) {
        var msg = JSON.parse(event.data);
        var obj;

        if (msg.type == 'line') {
            obj = new Line();

        } else if (msg.type == 'circle') {
            obj = new Circle();

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
    };
});

function Circle() {
    this.start = [];
    this.end = [];
    this.type = 'circle';

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.start.length <= 0) {
            this.start = [ e.clientX, e.clientY ];
            return false;
        }

        this.end = [ e.clientX, e.clientY ];

        drawables.push(this);
        return true;
    }

    this.draw = function (context) {
        var dx = this.start[0] - this.end[0];
        var dy = this.start[1] - this.end[1];

        var radius = Math.sqrt(dx * dx + dy * dy);

        context.beginPath();
        context.arc(this.start[0], this.start[1], radius, 0, 2 * Math.PI, false);
        context.stroke();
    }

    return this;
}

function Line() {
    this.start = [];
    this.end = [];
    this.type = 'line';

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.start.length <= 0) {
            this.start = [ e.clientX, e.clientY ];
            return false;
        }

        this.end = [ e.clientX, e.clientY ];
        return true;
    }

    this.draw = function (context) {
        context.beginPath();
        context.moveTo(this.start[0], this.start[1]);
        context.lineTo(this.end[0], this.end[1]);
        context.stroke();
    }

    return this;
}

function click(e) {
    console.log(e);

    if (1 != e.which) return true;

    if (inprogress.mouseClick(e)) {
        drawables.push(inprogress);
        socket.send(JSON.stringify(inprogress));
        inprogress = new Item();

        draw();
    }

    return true;
};

function resize() {
    var canvas = document.getElementById('sharedCanvas');

    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;

    draw();
}

function draw() {
    var canvas = document.getElementById('sharedCanvas');
    var context = canvas.getContext('2d');

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
