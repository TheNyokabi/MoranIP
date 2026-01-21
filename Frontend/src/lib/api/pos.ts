/**
 * Point of Sale API Client
 */
import { apiGet, apiPost, apiPut, apiDelete } from './client'
import type {
    PosProfile,
    PosProfileCreate,
    PosProfileUpdate,
    PosSession,
    PosSessionCreate,
    PosSessionClose,
    PosOrder,
    PosOrderCreate,
    PosOrderUpdate,
    PaymentRequest,
    Receipt
} from '../types/pos'

// ==================== Profile Management ====================

export async function createPosProfile(data: PosProfileCreate): Promise<PosProfile> {
    const response = await apiPost<{ data: PosProfile }>('/pos/profiles', data)
    return response.data
}

export async function getPosProfiles(warehouse?: string): Promise<PosProfile[]> {
    const params = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : ''
    const response = await apiGet<{ profiles: PosProfile[] }>(`/pos/profiles${params}`)
    return response.profiles
}

export async function getPosProfile(profileId: string): Promise<PosProfile> {
    const response = await apiGet<{ data: PosProfile }>(`/pos/profiles/${profileId}`)
    return response.data
}

export async function updatePosProfile(
    profileId: string,
    data: PosProfileUpdate
): Promise<PosProfile> {
    const response = await apiPut<{ data: PosProfile }>(`/pos/profiles/${profileId}`, data)
    return response.data
}

export async function deletePosProfile(profileId: string): Promise<boolean> {
    const response = await apiDelete<{ success: boolean }>(`/pos/profiles/${profileId}`)
    return response.success
}

// ==================== Session Management ====================

export async function openPosSession(data: PosSessionCreate): Promise<PosSession> {
    const response = await apiPost<{ data: PosSession }>('/pos/sessions', data)
    return response.data
}

export async function getPosSessions(
    profileId?: string,
    status?: string
): Promise<PosSession[]> {
    const params = new URLSearchParams()
    if (profileId) params.append('profile_id', profileId)
    if (status) params.append('status', status)

    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiGet<{ sessions: PosSession[] }>(`/pos/sessions${queryString}`)
    return response.sessions
}

export async function getPosSession(sessionId: string): Promise<PosSession> {
    const response = await apiGet<{ data: PosSession }>(`/pos/sessions/${sessionId}`)
    return response.data
}

export async function closePosSession(
    sessionId: string,
    data: PosSessionClose
): Promise<PosSession> {
    const response = await apiPut<{ data: PosSession }>(
        `/pos/sessions/${sessionId}/close`,
        data
    )
    return response.data
}

export async function getSessionSummary(sessionId: string): Promise<any> {
    const response = await apiGet<{ summary: any }>(`/pos/sessions/${sessionId}/summary`)
    return response.summary
}

// ==================== Order Management ====================

export async function createPosOrder(data: PosOrderCreate): Promise<PosOrder> {
    const response = await apiPost<{ data: PosOrder }>('/pos/orders', data)
    return response.data
}

export async function getPosOrders(sessionId?: string): Promise<PosOrder[]> {
    const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
    const response = await apiGet<{ orders: PosOrder[] }>(`/pos/orders${params}`)
    return response.orders
}

export async function getPosOrder(orderId: string): Promise<PosOrder> {
    const response = await apiGet<{ data: PosOrder }>(`/pos/orders/${orderId}`)
    return response.data
}

export async function updatePosOrder(
    orderId: string,
    data: PosOrderUpdate
): Promise<PosOrder> {
    const response = await apiPut<{ data: PosOrder }>(`/pos/orders/${orderId}`, data)
    return response.data
}

export async function processPayment(
    orderId: string,
    data: PaymentRequest
): Promise<PosOrder> {
    const response = await apiPost<{ data: PosOrder }>(
        `/pos/orders/${orderId}/payment`,
        data
    )
    return response.data
}

export async function cancelPosOrder(orderId: string): Promise<boolean> {
    const response = await apiDelete<{ success: boolean }>(`/pos/orders/${orderId}`)
    return response.success
}

export async function generateReceipt(orderId: string): Promise<Receipt> {
    const response = await apiPost<{ receipt: Receipt }>(`/pos/orders/${orderId}/receipt`, {})
    return response.receipt
}
