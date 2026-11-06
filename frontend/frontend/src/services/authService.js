import { apiRequest, initializeCsrf, updateProfile as updateProfileRequest } from './api.js'

export class AuthError extends Error {
	constructor(message, status, errors = {}) {
		super(message)
		this.name = 'AuthError'
		this.status = status
		this.errors = errors
	}
}

async function readResponse(response) {
	const payload = await response.json().catch(() => ({}))

	if (!response.ok) {
		const validationMessage = Object.values(payload.errors || {}).flat()[0]
		throw new AuthError(
			validationMessage || payload.message || 'Une erreur est survenue.',
			response.status,
			payload.errors || {},
		)
	}

	return payload
}

export async function getCurrentUser() {
	const response = await apiRequest('/api/user')

	if (response.status === 401) return null

	const payload = await readResponse(response)
	return payload.user
}

export async function signIn(credentials) {
	await initializeCsrf()

	const response = await apiRequest('/api/login', {
		method: 'POST',
		body: JSON.stringify(credentials),
	})

	return (await readResponse(response)).user
}

export async function signUp(details) {
	await initializeCsrf()

	const response = await apiRequest('/api/register', {
		method: 'POST',
		body: JSON.stringify(details),
	})

	return (await readResponse(response)).user
}

export async function signOut() {
	const response = await apiRequest('/api/logout', { method: 'POST' })
	return readResponse(response)
}

export async function saveProfile(details) {
	const response = await updateProfileRequest(details)
	return (await readResponse(response)).user
}
