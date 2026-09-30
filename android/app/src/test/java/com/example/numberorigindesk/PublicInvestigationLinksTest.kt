package com.example.numberorigindesk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PublicInvestigationLinksTest {
    @Test
    fun includesOfficialSearchAndCommunityDefaultsForUsNumber() {
        val links = PublicMapLinks.publicInvestigationLinks("+12025550123", "US", "2025550123")

        assertEquals("ITU E.164 assigned country codes", links.first().title)
        assertTrue(links.any { it.url == "https://secure.nanpa.com/public-report/npa/search-area-codes" })
        assertTrue(links.any { it.url == "https://localcallingguide.com/lca_prefix.php?npa=202&nxx=555" })
        assertTrue(links.any { it.url == "https://duckduckgo.com/?q=%22%2B12025550123%22%20phone" })
        assertTrue(links.any { it.url == "https://www.shouldianswer.com/phone-number/12025550123" })
        assertTrue(links.any { it.url == "https://800notes.com/Phone.aspx/1-202-555-0123" })
        assertTrue(links.any { it.url == "https://directory.youmail.com/phone/202-555-0123" })
        assertTrue(links.any { it.inAppScamLookup })
    }

    @Test
    fun usesCanadianAuthorityAndOmitsUsDirectory() {
        val links = PublicMapLinks.publicInvestigationLinks("+14165550123", "CA", "4165550123")

        assertTrue(links.any { it.url == "https://cnac.ca/data/COCodeStatus_NPA416.htm" })
        assertTrue(links.any { it.url == "https://localcallingguide.com/lca_prefix.php?npa=416&nxx=555" })
        assertFalse(links.any { it.title == "YouMail public directory" })
        assertFalse(links.any { it.category == "reporting" })
    }

    @Test
    fun usesCuratedUkAuthorityWithoutNanpSources() {
        val links = PublicMapLinks.publicInvestigationLinks("+442079460958", "GB", "2079460958")

        assertTrue(links.any { it.title == "Ofcom numbering allocation data" })
        assertFalse(links.any { it.title.contains("NANPA") || it.title.contains("800notes") })
        assertFalse(links.any { it.category == "reporting" })
    }
}
