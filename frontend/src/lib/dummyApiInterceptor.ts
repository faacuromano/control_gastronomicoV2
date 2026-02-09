/**
 * @fileoverview Axios request interceptor that returns mock responses
 * for sync and order endpoints when VITE_OFFLINE_MOCK is enabled.
 *
 * @module lib/dummyApiInterceptor
 */

import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { pullData, pushData, createOrder, addPayments } from './dummyApi';

type MockHandler = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

const routes: { pattern: RegExp; method: string; handler: MockHandler }[] = [
    {
        pattern: /\/sync\/pull$/,
        method: 'get',
        handler: async (config) => {
            const result = await pullData();
            return toAxiosResponse(result, config);
        },
    },
    {
        pattern: /\/sync\/push$/,
        method: 'post',
        handler: async (config) => {
            const result = await pushData(config.data ? JSON.parse(config.data) : {});
            return toAxiosResponse(result, config);
        },
    },
    {
        pattern: /\/orders$/,
        method: 'post',
        handler: async (config) => {
            const result = await createOrder(config.data ? JSON.parse(config.data) : {});
            return toAxiosResponse(result, config);
        },
    },
    {
        pattern: /\/orders\/(\d+)\/payments$/,
        method: 'post',
        handler: async (config) => {
            const match = config.url?.match(/\/orders\/(\d+)\/payments$/);
            const orderId = match ? parseInt(match[1], 10) : 0;
            const result = await addPayments(orderId, config.data ? JSON.parse(config.data) : {});
            return toAxiosResponse(result, config);
        },
    },
];

function toAxiosResponse(
    result: { data: unknown },
    config: InternalAxiosRequestConfig
): AxiosResponse {
    return {
        data: (result as { data: unknown }).data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
    } as AxiosResponse;
}

/**
 * Attach the dummy API interceptor to an Axios instance.
 * Intercepts requests matching known patterns and returns mock data.
 * Non-matching requests pass through to the real backend.
 */
export function attachDummyInterceptor(axiosInstance: {
    interceptors: {
        request: {
            use: (
                fn: (config: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>,
            ) => number;
        };
    };
}) {
    axiosInstance.interceptors.request.use(async (config) => {
        const url = config.url || '';
        const method = (config.method || 'get').toLowerCase();

        for (const route of routes) {
            if (route.pattern.test(url) && route.method === method) {
                console.log(`[DummyAPI] Intercepting ${method.toUpperCase()} ${url}`);
                const response = await route.handler(config);
                // Throw a "cancel" with the response attached so the response interceptor
                // can pick it up. We use adapter override instead.
                config.adapter = async () => response;
                return config;
            }
        }

        return config;
    });
}
