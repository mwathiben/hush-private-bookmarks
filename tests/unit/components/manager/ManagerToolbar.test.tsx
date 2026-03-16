// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManagerToolbar } from '@/components/manager/ManagerToolbar';

afterEach(cleanup);

function renderToolbar(overrides?: Partial<React.ComponentProps<typeof ManagerToolbar>>) {
  const defaults = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    onAddBookmark: vi.fn(),
    onAddFolder: vi.fn(),
    disabled: false,
    ...overrides,
  };
  const result = render(<ManagerToolbar {...defaults} />);
  const container = within(result.container as HTMLElement);
  return { ...result, container, props: defaults };
}

describe('ManagerToolbar', () => {
  it('renders search input with placeholder', () => {
    // #given / #when
    const { container } = renderToolbar();

    // #then
    expect(container.getByLabelText('Search bookmarks')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', async () => {
    // #given
    const user = userEvent.setup();
    const { container, props } = renderToolbar();

    // #when
    await user.type(container.getByLabelText('Search bookmarks'), 'test');

    // #then
    expect(props.onSearchChange).toHaveBeenCalled();
  });

  it('renders add bookmark button', () => {
    // #given / #when
    const { container } = renderToolbar();

    // #then
    expect(container.getByRole('button', { name: /bookmark/i })).toBeInTheDocument();
  });

  it('renders add folder button', () => {
    // #given / #when
    const { container } = renderToolbar();

    // #then
    expect(container.getByRole('button', { name: /folder/i })).toBeInTheDocument();
  });

  it('calls onAddBookmark when clicked', async () => {
    // #given
    const user = userEvent.setup();
    const { container, props } = renderToolbar();

    // #when
    await user.click(container.getByRole('button', { name: /bookmark/i }));

    // #then
    expect(props.onAddBookmark).toHaveBeenCalledOnce();
  });

  it('calls onAddFolder when clicked', async () => {
    // #given
    const user = userEvent.setup();
    const { container, props } = renderToolbar();

    // #when
    await user.click(container.getByRole('button', { name: /folder/i }));

    // #then
    expect(props.onAddFolder).toHaveBeenCalledOnce();
  });

  it('disables all controls when disabled=true', () => {
    // #given / #when
    const { container } = renderToolbar({ disabled: true });

    // #then
    expect(container.getByLabelText('Search bookmarks')).toBeDisabled();
    expect(container.getByRole('button', { name: /bookmark/i })).toBeDisabled();
    expect(container.getByRole('button', { name: /folder/i })).toBeDisabled();
  });

  it('displays current searchQuery value', () => {
    // #given / #when
    const { container } = renderToolbar({ searchQuery: 'hello' });

    // #then
    expect(container.getByLabelText('Search bookmarks')).toHaveValue('hello');
  });
});
