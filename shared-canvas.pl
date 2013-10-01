#!/usr/bin/env perl

use strict;
use warnings;

use Mojolicious::Lite;
use Redis;
use Time::HiRes qw ( time );
use UUID::Tiny;

# A bunch of global variables. YAY!
my %sockets;
my $redis = Redis->new(sock => '/tmp/redis.sock');

# Documentation browser under "/perldoc"
get '/' => sub {
    my $self = shift;
    $self->redirect_to('/index.html');
};

get '/new-room' => sub {
    my $self = shift;
    my $roomid = UUID::Tiny::create_uuid_as_string(UUID_V4);
    $redis->zadd($roomid, 0, "");
    $self->redirect_to('/' . $roomid);
};

get '/:roomid' => sub {
    my $self = shift;
    $self->render('room', roomid => $self->stash->{'roomid'});
};

# WebSocket echo service
websocket '/:room/socket/:client' => sub {
    my $self = shift;

    my $roomid = $self->stash->{'room'};
    my $clientid = $self->stash->{'client'};

    $self->app->log->debug("WebSocket opened in room $roomid for $clientid");
    $sockets{$roomid}{$clientid} = $self;

    my @commands = $redis->zrevrange($roomid, 0, '-1');
    for (@commands) {
        $self->app->log->debug("Sending $_ to $clientid");
        $self->send($_);
    }

    # Increase inactivity timeout for connection a bit
    Mojo::IOLoop->stream($self->tx->connection)->timeout(300);

    # Incoming message
    $self->on(message => sub {
        my ($self, $msg) = @_;
        $self->app->log->debug("Got $msg from $clientid");
        $redis->zadd($roomid, time, $msg);

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

    <script type="application/javascript">
        var roomid = '<%= $roomid %>';
    </script>

    <script src="/js/underscore.js"></script>
    <script src="/js/zepto.js"></script>
    <script src="/js/shared-canvas.js"></script>
  </head>
  <body><canvas id="sharedCanvas" height=480 width=640></canvas></body>
</html>
