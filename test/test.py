from DrissionPage import ChromiumPage
from DrissionPage.common import Keys
import time

page = ChromiumPage()
page.get("https://camping.bcparks.ca/")


page.ele('@aria-label=Select park').input('Porteau Cove')
time.sleep(2)
page.actions.type(Keys.TAB)


# Click element
page.ele('[type=text]').click()

# Click element
page.ele('View next month, Nov 2024').click()

# Click element
page.ele('@aria-label=Nov 2024').click()

# Click element
page.ele('@aria-label=Nov 2024').click()

# Click element
page.ele('@aria-label=Search').click()

# Click element
page.ele('Van/Camper').click()

# Click element
page.ele('@role=img').click()

# Navigate to URL
page.get("https://www.google.com/search?q=abc&sca_esv=b898c048dc632a6a&source=hp&ei=lGUgZ5mrH9jL0PEPyoTx2QI&oq=abc&gs_lp=EhFtb2JpbGUtZ3dzLXdpei1ocCIDYWJjMgsQABiABBixAxiDATILEAAYgAQYsQMYgwEyERAuGIAEGLEDGNEDGIMBGMcBMggQABiABBixAzILEAAYgAQYsQMYgwEyCxAuGIAEGMcBGK8BMgsQLhiABBjRAxjHATIFEAAYgARInwhQtwNYlwdwAXgAkAEAmAFvoAGoAqoBAzEuMrgBA8gBAPgBAZgCBKACtQKoAhPCAgIQKcICEBAuGAMY5QIY6gIYjAMYjwHCAhAQABgDGOUCGOoCGIwDGI8BwgIUEC4YgAQYkQIYxwEYigUYjgUYrwHCAgsQLhiABBiRAhiKBcICDhAuGIAEGLEDGIMBGIoFwgIOEC4YgAQYkQIYsQMYigXCAg4QLhiABBixAxjRAxjHAcICDhAAGIAEGLEDGIMBGIoFwgIEEAAYA8ICDhAuGIAEGMcBGI4FGK8BmAMJkgcDMi4yoAeVJw&sclient=mobile-gws-wiz-hp")
