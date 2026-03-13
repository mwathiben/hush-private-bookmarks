// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';

import { useSendMessage } from '@/hooks/useSendMessage';
import type { BackgroundResponse } from '@/lib/background-types';

describe('useSendMessage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('sends message via browser.runtime.sendMessage and returns response', async () => {
    // #given
    const expected: BackgroundResponse = { success: true, data: 'test' };
    vi.spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(() => Promise.resolve(expected));
    const { result } = renderHook(() => useSendMessage());

    // #when
    const response = await result.current({ type: 'GET_STATE' });

    // #then
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_STATE' });
    expect(response).toEqual(expected);
  });

  it('retries with exponential backoff on connection failure', async () => {
    // #given
    const expected: BackgroundResponse = { success: true };
    const spy = vi.spyOn(browser.runtime, 'sendMessage')
      .mockImplementationOnce(() => Promise.reject(new Error('Could not establish connection')))
      .mockImplementationOnce(() => Promise.reject(new Error('Could not establish connection')))
      .mockImplementationOnce(() => Promise.resolve(expected));
    const { result } = renderHook(() => useSendMessage());

    // #when
    const promise = result.current({ type: 'LOCK' });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    const response = await promise;

    // #then
    expect(spy).toHaveBeenCalledTimes(3);
    expect(response).toEqual(expected);
  });

  it('throws after exhausting all retries', async () => {
    // #given
    vi.useRealTimers();
    const error = new Error('Could not establish connection');
    vi.spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(() => Promise.reject(error));
    const { result } = renderHook(() => useSendMessage());

    // #when / #then
    await expect(result.current({ type: 'GET_STATE' }))
      .rejects.toThrow('Could not establish connection');
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(4);
  });

  it('does not retry non-transport errors', async () => {
    // #given
    vi.useRealTimers();
    vi.spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(() => Promise.reject(new TypeError('Cannot read properties')));
    const { result } = renderHook(() => useSendMessage());

    // #when / #then
    await expect(result.current({ type: 'GET_STATE' }))
      .rejects.toThrow('Cannot read properties');
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('throws on undefined response from background', async () => {
    // #given
    vi.spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(() => Promise.resolve(undefined));
    const { result } = renderHook(() => useSendMessage());

    // #when / #then
    await expect(result.current({ type: 'GET_STATE' }))
      .rejects.toThrow('Invalid response from background');
  });

  it('returns a stable function reference across renders', () => {
    // #given
    const { result, rerender } = renderHook(() => useSendMessage());
    const first = result.current;

    // #when
    rerender();

    // #then
    expect(result.current).toBe(first);
  });
});
