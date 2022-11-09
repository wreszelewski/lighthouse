/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import jestMock from 'jest-mock';
import * as td from 'testdouble';

const mockMainResource = jestMock.fn();
await td.replaceEsm('../../../computed/main-resource.js', {
  MainResource: {request: mockMainResource},
});

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// https://github.com/GoogleChrome/lighthouse/blob/main/docs/hacking-tips.md#mocking-modules-with-testdouble
/** @typedef {import('../../../gather/gatherers/link-elements.js').default} LinkElements */
const LinkElements = (await import('../../../gather/gatherers/link-elements.js')).default;

beforeEach(() => {
  mockMainResource.mockReset();
});

describe('Link Elements gatherer', () => {
  /**
   * @param {Partial<LH.Artifact.LinkElement>} overrides
   * @return {LH.Artifact.LinkElement}
   */
  function link(overrides) {
    if (overrides.href && !overrides.hrefRaw) overrides.hrefRaw = overrides.href;
    return {
      rel: '',
      href: null,
      hrefRaw: '',
      hreflang: '',
      as: '',
      crossOrigin: null,
      node: null,
      ...overrides,
    };
  }

  function getPassData({linkElementsInDOM = [], headers = []}) {
    const url = 'https://example.com';
    mockMainResource.mockReturnValue({url, responseHeaders: headers, resourceType: 'Document'});
    const driver = {
      executionContext: {
        evaluate: () => Promise.resolve(linkElementsInDOM),
      },
    };
    const baseArtifacts = {
      URL: {
        finalDisplayedUrl: url,
      },
    };
    const passContext = {driver, url, baseArtifacts, computedCache: new Map()};
    return [passContext, {}];
  }

  it('returns elements from DOM', async () => {
    const linkElementsInDOM = [
      link({source: 'head', rel: 'preconnect', href: 'https://cdn.example.com'}),
      link({source: 'head', rel: 'styleSheeT', href: 'https://example.com/a.css'}),
      link({source: 'body', rel: 'ICON', href: 'https://example.com/a.png'}),
    ];

    const result = await new LinkElements().afterPass(...getPassData({linkElementsInDOM}));
    expect(result).toEqual([
      link({source: 'head', rel: 'preconnect', href: 'https://cdn.example.com'}),
      link({source: 'head', rel: 'stylesheet', href: 'https://example.com/a.css'}),
      link({source: 'body', rel: 'icon', href: 'https://example.com/a.png'}),
    ]);
  });

  it('returns elements from headers', async () => {
    const headers = [
      {name: 'Link', value: '<https://example.com/>; rel=prefetch; as=image'},
      {name: 'link', value: '<https://example.com/>; rel=preconnect; crossorigin=anonymous'},
      {name: 'Link', value: '<https://example.com/style.css>; rel="preload",</>; rel="canonical"'},
      {name: 'LINK', value: '<https://example.com/>; rel=alternate; hreflang=xx'},
    ];

    const result = await new LinkElements().afterPass(...getPassData({headers}));
    expect(result).toEqual([
      link({source: 'headers', rel: 'prefetch', href: 'https://example.com/', as: 'image'}),
      link({source: 'headers', rel: 'preconnect', href: 'https://example.com/', crossOrigin: 'anonymous'}), // eslint-disable-line max-len
      link({source: 'headers', rel: 'preload', href: 'https://example.com/style.css'}),
      link({source: 'headers', rel: 'canonical', href: 'https://example.com/', hrefRaw: '/'}),
      link({source: 'headers', rel: 'alternate', href: 'https://example.com/', hreflang: 'xx'}),
    ]);
  });

  it('combines elements from headers and DOM', async () => {
    const linkElementsInDOM = [
      link({source: 'head', rel: 'styleSheeT', href: 'https://example.com/a.css'}),
      link({source: 'body', rel: 'ICON', href: 'https://example.com/a.png'}),
    ];

    const headers = [
      {name: 'Link', value: '<https://example.com/>; rel=prefetch; as=image'},
    ];

    const result = await new LinkElements().afterPass(...getPassData({linkElementsInDOM, headers}));
    expect(result).toEqual([
      link({source: 'head', rel: 'stylesheet', href: 'https://example.com/a.css'}),
      link({source: 'body', rel: 'icon', href: 'https://example.com/a.png'}),
      link({source: 'headers', rel: 'prefetch', href: 'https://example.com/', as: 'image'}),
    ]);
  });
});
