import { apiRequest, initializeCsrf, readJson, updateProfile as updateProfileRequest } from './api.js'

export class AuthError extends Error {
	constructor(message, status, errors = {}) {
		super(message)
		this.name = 'AuthError'
		this.status = status
		this.errors = errors
	}
}

async function readResponse(response) {
	try {
		return await readJson(response)
	} catch (error) {
		throw new AuthError(error.message, error.status, error.errors)
	}
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

// Option pour les clients : `accessToken` est le jeton d'accès renvoyé par le bouton « Continuer avec Google ».
// Le compte client est créé automatiquement à la première connexion.
export async function signInWithGoogle(accessToken) {
	await initializeCsrf()

	const response = await apiRequest('/api/auth/google', {
		method: 'POST',
		body: JSON.stringify({ access_token: accessToken }),
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
