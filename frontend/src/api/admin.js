import client from './client'

export const fetchAdminStats = () =>
  client.get('/admin/stats/').then((r) => r.data)

export const fetchAdminUsers = () =>
  client.get('/admin/users/').then((r) => r.data)

export const fetchAdminExercises = () =>
  client.get('/admin/exercises/').then((r) => r.data)
