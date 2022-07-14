use std::sync::mpsc::{channel};

// CUSTOM MODULES DEFINITION+
mod consts;
mod utils;
mod player;
mod board;
mod render;
mod input;
mod ipc;
mod game;
mod milestones;

use ipc::{start_ipc_sender, start_ipc_receiver};
use game::{game_loop};

pub const MAX_PLAYERS: i8 = 8;
pub const BOARD_SIZE: usize = 60;
pub const MAX_ITERATIONS: i32 = 300;
pub const TIME_BETWEEN_ITERATIONS: u64 = 500;
pub const STARTING_RESOURCES: i32 = (BOARD_SIZE * BOARD_SIZE * 10) as i32;
pub const RESOURCES_TO_CONQUER_EMPTY_CELL: i32 = 1;
pub const RESOURCES_TO_CONQUER_FILLED_CELL: i32 = 10;
const RESOURCES_AT_END_ROUND:i32 = 100;
const DEVELOPMENT_AT_END_ROUND:i32 = 5;
const MAX_DEVELOPMENT:i32 = 100;
const STARTING_POSITIONS:[(usize, usize); MAX_PLAYERS as usize] = [
    (1, 1),
    (BOARD_SIZE / 2, 1),
    (BOARD_SIZE - 2, 1),
    (BOARD_SIZE - 2, BOARD_SIZE / 2),
    (BOARD_SIZE - 2, BOARD_SIZE - 2),
    (BOARD_SIZE / 2, BOARD_SIZE - 2),
    (1, BOARD_SIZE - 2),
    (1, BOARD_SIZE / 2),
];
pub const SOCKET_TO_NODE: &str = env!("SOCKET_TO_NODE");
pub const SOCKET_FROM_NODE: &str = env!("SOCKET_FROM_NODE");


fn main() {

    // START THREAD CHANNELS
    let (to_node_tx, sender_rx) = channel();
    let (receiver_tx, from_node_rx) = channel();

    // START IPC SOCKETS
    start_ipc_sender(sender_rx);
    start_ipc_receiver(receiver_tx);

    game_loop(from_node_rx, to_node_tx);
}








