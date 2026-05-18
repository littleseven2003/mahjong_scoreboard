import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import CreateRoomView from './views/CreateRoomView.vue'
import JoinRoomView from './views/JoinRoomView.vue'
import RoomView from './views/RoomView.vue'
import HistoryView from './views/HistoryView.vue'
import HistoryDetailView from './views/HistoryDetailView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/room/create', component: CreateRoomView },
    { path: '/room/join', component: JoinRoomView },
    { path: '/room/:code', component: RoomView, props: true },
    { path: '/history', component: HistoryView },
    { path: '/history/:id', component: HistoryDetailView, props: true }
  ]
})
