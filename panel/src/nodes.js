const PROXY = '/proxy'

export async function getNodes() {
  const res = await fetch(`${PROXY}/nodes`)
  return res.json()
}

export async function addNode(data) {
  const res = await fetch(`${PROXY}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json
}

export async function updateNode(id, data) {
  const res = await fetch(`${PROXY}/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json
}

export async function deleteNode(id) {
  const res = await fetch(`${PROXY}/nodes/${id}`, { method: 'DELETE' })
  return res.json()
}
