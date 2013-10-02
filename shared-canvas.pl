#!/usr/bin/env perl

use strict;
use warnings;

use JSON;
use Mojolicious::Lite;
use Redis;
use Time::HiRes qw ( time );
use UUID::Tiny;

# A bunch of global variables. YAY!
my %sockets;
my $redis = Redis->new(sock => '/tmp/redis.sock');

get '/' => sub {
    my $self = shift;
    $self->redirect_to('/index.html');
};

get '/new-room' => sub {
    my $self = shift;
    my $roomid = UUID::Tiny::create_uuid_as_string(UUID_V4);

    $redis->zadd($roomid, 0, "");
    $redis->expire($roomid, 3600 * 48);

    $self->redirect_to('/' . $roomid);
};

get '/:roomid' => sub {
    my $self = shift;
    my $roomid = $self->stash->{'roomid'};

    if (not UUID::Tiny::is_UUID_string($roomid)) {
        $self->render({text => 'Invalid room identifier', status => '403'});
        return;
    }

    if (not $redis->exists($roomid)) {
        $self->render({text => 'Room does not exist', status => '410'});
        return;
    }

    $self->render('room', roomid => $roomid);
};

websocket '/:room/socket/:client' => sub {
    my $self = shift;

    my $roomid = $self->stash->{'room'};
    my $clientid = $self->stash->{'client'};

    $self->app->log->debug("WebSocket opened in room $roomid for $clientid");
    $sockets{$roomid}{$clientid} = $self;

    my @commands = $redis->zrevrange($roomid, 0, '-1');
    for (@commands) {
        next if $_ eq "";

        $self->app->log->debug("Sending $_ to $clientid");
        $self->send($_);
    }

    # Increase inactivity timeout for connection a bit
    Mojo::IOLoop->stream($self->tx->connection)->timeout(3000);

    # Incoming message
    $self->on(message => sub {
        my ($self, $msg) = @_;
        my $parsed = JSON::decode_json($msg);

        return if not $parsed->{type};

        return if $parsed->{type} eq 'ping';

        $self->app->log->debug("Got $msg from $clientid");

        $redis->zadd($roomid, time, $msg);
        $redis->expire($roomid, 3600 * 48);

        for (keys $sockets{$roomid}) {
            next if $_ eq $clientid;
            $self->app->log->debug("Sending $msg to $_");
            $sockets{$roomid}{$_}->send($msg);
        }
    });

    # Closed
    $self->on(finish => sub {
        my ($self, $code, $reason) = @_;
        $self->app->log->debug("WebSocket for $clientid closed with status $code.");
        delete $sockets{$roomid}{$clientid};
    });
};

app->start;
__DATA__

@@ room.html.ep
% layout 'default';
% title 'Welcome';
Welcome to the Mojolicious real-time web framework!

@@ layouts/default.html.ep
<!DOCTYPE html>
<html>
  <head>
    <title><%= title %></title>

    <link rel="stylesheet" href="/css/shared-canvas.css">
    <link rel="stylesheet" href="/css/pure/0.3.0/base-min.css">
    <link rel="stylesheet" href="/css/pure/0.3.0/pure-min.css">

    <script type="application/javascript">
        var roomid = '<%= $roomid %>';
    </script>

    <script src="/js/underscore.js"></script>
    <script src="/js/zepto.js"></script>
    <script src="/js/shared-canvas.js"></script>
  </head>
  <body>
    <canvas id="sharedCanvas" height=480 width=640></canvas>

    <div id="modeMenu" style="width: 10%; display: none; position: absolute;" class="pure-menu pure-menu-open">
      <ul id="modeMenuUL">
      </ul>
    </div>
  </body>
</html>
