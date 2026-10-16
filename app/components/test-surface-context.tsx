'use client';
import {createContext, useContext} from 'react';

export const TestSurfaceContext = createContext(false);
export const useTestSurface = () => useContext(TestSurfaceContext);
