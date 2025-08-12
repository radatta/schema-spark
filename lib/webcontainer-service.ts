"use client";

import { WebContainer } from "@webcontainer/api";

// This file creates a singleton WebContainer instance that can be used across the application

// Check if browser supports WebContainers
export const isBrowserCompatible = () => {
    return (
        typeof window !== "undefined" &&
        window.crossOriginIsolated !== undefined &&
        window.crossOriginIsolated === true
    );
};

// Global WebContainer instance
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

// Get or create the WebContainer instance
export async function getWebContainerInstance(): Promise<WebContainer | null> {
    // If browser doesn't support WebContainers, return null
    if (!isBrowserCompatible()) {
        return null;
    }

    // If we already have an instance, return it
    if (webcontainerInstance) {
        return webcontainerInstance;
    }

    // If we're already booting, return the promise
    if (bootPromise) {
        return bootPromise;
    }

    // Otherwise, boot a new instance
    try {
        bootPromise = WebContainer.boot();
        webcontainerInstance = await bootPromise;
        return webcontainerInstance;
    } catch (error) {
        bootPromise = null;
        return null;
    }
}

// Reset the WebContainer instance (useful for testing or forced reboot)
export function resetWebContainerInstance() {
    webcontainerInstance = null;
    bootPromise = null;
}
