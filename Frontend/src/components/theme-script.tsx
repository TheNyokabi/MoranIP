"use client"

import * as React from "react"

export function ThemeScript() {
    return (
        <script
            dangerouslySetInnerHTML={{
                __html: `
                    (function() {
                        const theme = localStorage.getItem('theme');
                        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                            document.documentElement.classList.add('dark');
                        }
                    })();
                `,
            }}
        />
    )
}
