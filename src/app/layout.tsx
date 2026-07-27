'use client';

import "./globals.css";
import {AppRouterCacheProvider} from '@mui/material-nextjs/v15-appRouter'
import {pelicanTheme as theme} from "@chtc/web-components/themes"
import {ThemeProvider} from '@mui/material'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <body>
          {children}
        </body>
      </ThemeProvider>

    </AppRouterCacheProvider>
    </html>
  );
}
