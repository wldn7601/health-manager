import client from './client'

export const fetchCategories = () =>
  client.get('/categories/').then((r) => r.data)

export const fetchExercises = (categoryId) =>
  client
    .get('/exercises/', { params: categoryId ? { category: categoryId } : {} })
    .then((r) => r.data)

export const fetchExercise = (id) =>
  client.get(`/exercises/${id}/`).then((r) => r.data)

export const fetchExerciseHistory = (id) =>
  client.get(`/exercises/${id}/history/`).then((r) => r.data)

export const fetchExerciseTips = (id) =>
  client.get(`/exercises/${id}/tips/`).then((r) => r.data)

export const searchExercise = ({ category, query }) =>
  client.post('/exercises/search/', { category, query }).then((r) => r.data)

export const createExercise = ({ category, canonical_name }) =>
  client
    .post('/exercises/', { category, canonical_name })
    .then((r) => r.data)

export const fetchSessions = ({ date, start, end } = {}) => {
  const params = {}
  if (date) params.date = date
  if (start) params.start = start
  if (end) params.end = end
  return client.get('/sessions/', { params }).then((r) => r.data)
}

export const createSession = ({ date }) =>
  client.post('/sessions/', { date }).then((r) => r.data)

export const createSet = (sessionId, { exercise, set_number, weight, reps, set_type = 'normal' }) =>
  client
    .post(`/sessions/${sessionId}/sets/`, { exercise, set_number, weight, reps, set_type })
    .then((r) => r.data)

export const createGroupedSets = (sessionId, { group_type, sets }) =>
  client
    .post(`/sessions/${sessionId}/grouped_sets/`, { group_type, sets })
    .then((r) => r.data)

export const createTip = (sessionId, { exercise, content }) =>
  client
    .post(`/sessions/${sessionId}/tips/`, { exercise, content })
    .then((r) => r.data)

export const fetchExerciseProgress = (id, period = '3m') =>
  client
    .get(`/exercises/${id}/progress/`, { params: { period } })
    .then((r) => r.data)

export const expandToDropset = (id, { drops }) =>
  client.post(`/sets/${id}/expand_dropset/`, { drops }).then((r) => r.data)

export const updateSet = (id, { weight, reps, set_type }) =>
  client.patch(`/sets/${id}/`, { weight, reps, set_type }).then((r) => r.data)

export const deleteSet = (id) =>
  client.delete(`/sets/${id}/`)
