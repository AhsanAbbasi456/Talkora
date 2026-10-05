import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "notifications",
  initialState: {
    unreadBySender: {}, // { [senderId]: { count, sender, lastBody, lastAt } }
    items: [],
  },
  reducers: {
    setPending(state, { payload: { messages, others } }) {
      state.unreadBySender = {};
      messages.forEach((m) => {
        state.unreadBySender[m.senderId] = m;
      });
      state.items = others;
    },
    messageArrived(state, { payload }) {
      const cur = state.unreadBySender[payload.senderId];
      state.unreadBySender[payload.senderId] = {
        senderId: payload.senderId,
        conversationId: payload.conversationId,
        sender: payload.sender,
        lastBody: payload.body,
        lastAt: payload.createdAt,
        count: (cur?.count || 0) + 1,
      };
    },
    senderRead(state, { payload: senderId }) {
      delete state.unreadBySender[senderId];
    },
    addNotification(state, { payload }) {
      if (!state.items.some((n) => n.id === payload.id)) {
        state.items.unshift(payload);
      }
    },
  },
});

export const { setPending, messageArrived, senderRead, addNotification } =
  slice.actions;
export default slice.reducer;