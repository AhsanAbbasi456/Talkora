import socket from "../socket";

// Adds several socket listeners and returns one function that removes them all.
export const listen = (events) => {
  Object.entries(events).forEach(([name, fn]) => socket.on(name, fn));
  return () => Object.entries(events).forEach(([name, fn]) => socket.off(name, fn));
};