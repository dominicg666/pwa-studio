import React, { useState } from 'react';
import { replace, useLocation } from 'react-router-dom';
import { act, create } from 'react-test-renderer';
import { useQuery } from '@apollo/client';
import { useRootComponents } from '@magento/peregrine/lib/context/rootComponents';
import { useAppContext } from '../../../context/app';

import { getRootComponent } from '../helpers';
import { useMagentoRoute } from '../useMagentoRoute';

jest.mock('../../../context/app', () => {
    const state = {
        nextRootComponent: null,
        isPageLoading: false
    };
    const api = {
        actions: {
            setNextRootComponent: jest.fn(),
            setPageLoading: jest.fn()
        }
    };
    const useAppContext = jest.fn(() => [state, api]);

    return { useAppContext };
});

jest.mock('@apollo/client', () => {
    const ApolloClient = jest.requireActual('@apollo/client');
    const useQuery = jest.fn();

    return {
        ...ApolloClient,
        useQuery
    };
});

jest.mock('react-router-dom', () => {
    const ReactRouter = jest.requireActual('react-router-dom');
    const replace = jest.fn();
    const useHistory = jest.fn(() => ({ replace }));
    const useLocation = jest.fn(() => ({ pathname: '/foo.html' }));

    return {
        ...ReactRouter,
        useHistory,
        useLocation,
        replace
    };
});

jest.mock('@magento/peregrine/lib/context/rootComponents', () => ({
    useRootComponents: jest.fn()
}));
useRootComponents.mockImplementation(() => useState(new Map()));

jest.mock('../helpers', () => {
    const helpers = jest.requireActual('../helpers');
    const getRootComponent = jest.fn();

    return {
        ...helpers,
        getRootComponent
    };
});

const resolve = jest.fn().mockName('resolve');
const reject = jest.fn().mockName('reject');
getRootComponent.mockImplementation(
    () =>
        new Promise((res, rej) => {
            resolve.mockImplementation(res);
            reject.mockImplementation(rej);
        })
);

const log = jest.fn().mockName('log');
const Component = () => {
    log(useMagentoRoute());
    return null;
};

beforeEach(() => {
    log.mockClear();
    useQuery.mockReset();
    useQuery.mockImplementation(() => {
        return {
            data: {
                urlResolver: {
                    id: 1,
                    redirectCode: 0,
                    relative_url: '/foo.html',
                    type: 'CATEGORY'
                }
            },
            loading: false
        };
    });
    useLocation.mockReset();
    useLocation.mockImplementation(() => ({ pathname: '/foo.html' }));

    useAppContext.mockImplementation(() => {
        const state = {
            nextRootComponent: null,
            isPageLoading: false
        };
        const api = {
            actions: {
                setNextRootComponent: jest.fn(),
                setPageLoading: jest.fn()
            }
        };

        return [state, api];
    });
});

describe('returns LOADING while queries are pending', () => {
    test('urlResolver is loading', async () => {
        useQuery.mockImplementation(() => {
            return { loading: true };
        });

        await act(() => {
            create(<Component />);
        });

        expect(replace).toHaveBeenCalledTimes(0);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(1, {
            isLoading: true
        });
    });

    test('getRootComponent is pending', async () => {
        await act(() => {
            create(<Component />);
        });

        expect(replace).toHaveBeenCalledTimes(0);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(1, {
            isLoading: true
        });
    });
});

describe('returns ERROR when queries fail', () => {
    test('urlResolver fails', async () => {
        useQuery.mockImplementation(() => {
            return { error: new Error() };
        });

        await act(() => {
            create(<Component />);
        });

        expect(replace).toHaveBeenCalledTimes(0);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(1, {
            hasError: true,
            routeError: expect.any(Error)
        });
    });

    test('getRootComponent fails', async () => {
        const routeError = new Error();

        await act(() => {
            create(<Component />);
        });

        await act(() => {
            reject(routeError);
        });

        expect(replace).toHaveBeenCalledTimes(0);
        expect(log).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenNthCalledWith(1, {
            isLoading: true
        });
        expect(log).toHaveBeenNthCalledWith(2, {
            hasError: true,
            routeError
        });
    });
});

describe('returns NOT_FOUND when queries come back empty', () => {
    test('urlResolver is null', async () => {
        useQuery.mockImplementationOnce(() => {
            return {
                data: {
                    urlResolver: null
                },
                loading: false
            };
        });

        await act(() => {
            create(<Component />);
        });

        expect(replace).toHaveBeenCalledTimes(0);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(1, {
            isNotFound: true
        });
    });
});

describe('returns REDIRECT after receiving a redirect code', () => {
    test('redirect code 301', async () => {
        useQuery.mockImplementation(() => {
            return {
                data: {
                    urlResolver: {
                        id: 1,
                        redirectCode: 301,
                        relative_url: '/foo.html',
                        type: 'CATEGORY'
                    }
                },
                loading: false
            };
        });

        await act(() => {
            create(<Component />);
        });

        expect(replace).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(1, {
            isRedirect: true,
            relativeUrl: '/foo.html'
        });
    });

    test('redirect code 302', async () => {
        useQuery.mockImplementation(() => {
            return {
                data: {
                    urlResolver: {
                        id: 1,
                        redirectCode: 302,
                        relative_url: '/foo.html',
                        type: 'CATEGORY'
                    }
                },
                loading: false
            };
        });

        await act(() => {
            create(<Component />);
        });

        expect(replace).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(1, {
            isRedirect: true,
            relativeUrl: '/foo.html'
        });
    });
});

describe('returns FOUND after fetching a component', () => {
    test('getRootComponent succeeds', async () => {
        await act(() => {
            create(<Component />);
        });

        await act(() => {
            resolve('MockComponent');
        });

        expect(replace).toHaveBeenCalledTimes(0);
        expect(log).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenNthCalledWith(1, {
            isLoading: true
        });
        expect(log).toHaveBeenNthCalledWith(2, {
            component: 'MockComponent',
            id: 1,
            type: 'CATEGORY'
        });
    });
});

describe('avoids fetching the same component twice', () => {
    test('getRootComponent succeeds', async () => {
        let tree;

        await act(() => {
            tree = create(<Component key="a" />);
        });

        await act(() => {
            resolve('MockComponent');
        });

        await act(() => {
            tree.update(<Component key="a" />);
        });

        expect(getRootComponent).toHaveBeenCalledTimes(1);
        expect(getRootComponent).toHaveBeenNthCalledWith(1, 'CATEGORY');
    });
});

describe('avoids setting state when unmounted', () => {
    test('getRootComponent resolves after unmount', async () => {
        let tree;

        await act(() => {
            tree = create(<Component />);
        });

        await act(() => {
            tree.unmount();
        });

        await act(() => {
            resolve('MockComponent');
        });

        expect(tree).toBeTruthy();
    });
});

describe('previous component', () => {
    test('is returned when available', async () => {
        useQuery.mockImplementation(() => {
            return {
                data: {
                    urlResolver: {
                        id: 1,
                        type: 'CATEGORY'
                    }
                },
                loading: false
            };
        });

        let tree;

        await act(() => {
            tree = create(<Component key="a" />);
        });

        await act(() => {
            resolve('MockComponent');
        });

        await act(() => {
            tree.update(<Component key="a" />);
        });

        useLocation.mockImplementation(() => ({ pathname: '/bar.html' }));

        useQuery.mockImplementation(() => {
            return {
                data: {
                    urlResolver: {
                        id: 2,
                        type: 'CMS_PAGE'
                    }
                },
                loading: false
            };
        });

        await act(() => {
            tree.update(<Component key="a" />);
        });

        await act(() => {
            resolve('MockComponent2');
        });

        await act(() => {
            tree.update(<Component key="a" />);
        });

        // loading w/ type null
        expect(log).toHaveBeenNthCalledWith(1, {
            isLoading: true
        });

        // component = MockComponent
        expect(log).toHaveBeenNthCalledWith(2, {
            component: 'MockComponent',
            id: 1,
            type: 'CATEGORY'
        });

        // Skip calls 3,4 which return same value

        // loading w/ previous component MockComponent
        expect(log).toHaveBeenNthCalledWith(5, {
            isLoading: true,
            component: 'MockComponent',
            id: 1,
            type: 'CATEGORY'
        });

        // component = MockComponent2
        expect(log).toHaveBeenNthCalledWith(6, {
            component: 'MockComponent2',
            id: 2,
            type: 'CMS_PAGE'
        });
    });
});

describe('loading type', async () => {
    test('is returned', async () => {
        useAppContext.mockImplementationOnce(() => {
            const state = {
                nextRootComponent: 'TEST_TYPE_SHIMMER',
                isPageLoading: false
            };
            const api = {
                actions: {
                    setNextRootComponent: jest.fn(),
                    setPageLoading: jest.fn()
                }
            };

            return [state, api];
        });

        useQuery.mockImplementationOnce(() => {
            return { loading: true };
        });

        await act(() => {
            create(<Component />);
        });

        expect(log).toHaveBeenCalledWith({
            isLoading: true,
            shimmer: 'TEST_TYPE_SHIMMER'
        });
    });

    test('is reset when component is returned', async () => {
        let mockNextRootComponent = 'TEST_TYPE_SHIMMER';
        const mockSetNextRootComponent = jest.fn(type => {
            mockNextRootComponent = type;
        });

        useAppContext.mockImplementation(() => {
            const state = {
                nextRootComponent: mockNextRootComponent,
                isPageLoading: false
            };
            const api = {
                actions: {
                    setNextRootComponent: mockSetNextRootComponent,
                    setPageLoading: jest.fn()
                }
            };

            return [state, api];
        });

        useQuery.mockImplementationOnce(() => {
            return { loading: true };
        });

        let tree;

        await act(() => {
            tree = create(<Component key="a" />);
        });

        useQuery.mockImplementation(() => {
            return {
                data: {
                    urlResolver: {
                        id: 1,
                        type: 'CATEGORY'
                    }
                },
                loading: false
            };
        });

        await act(() => {
            tree.update(<Component key="a" />);
        });

        await act(() => {
            resolve('MockComponent');
        });

        await act(() => {
            tree.update(<Component key="a" />);
        });

        expect(log).toHaveBeenNthCalledWith(1, {
            isLoading: true,
            shimmer: 'TEST_TYPE_SHIMMER'
        });

        expect(mockSetNextRootComponent).toHaveBeenCalledWith(null);
    });
});
