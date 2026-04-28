import client from './client'

export const fetchAdminStats = () =>
  client.get('/admin/stats/').then((r) => r.data)

export const fetchAdminUsers = () =>
  client.get('/admin/users/').then((r) => r.data)

export const fetchAdminExercises = () =>
  client.get('/admin/exercises/').then((r) => r.data)

export const updateAdminExercise = (id, data) =>
  client.patch(`/admin/exercises/${id}/`, data).then((r) => r.data)

export const fetchAdminExerciseRequests = (status) =>
  client.get('/admin/exercise-requests/', { params: status ? { status } : {} }).then((r) => r.data)

export const actionExerciseRequest = (id, action) =>
  client.patch(`/admin/exercise-requests/${id}/`, { action }).then((r) => r.data)
