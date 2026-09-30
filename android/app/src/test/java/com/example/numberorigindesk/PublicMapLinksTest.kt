package com.example.numberorigindesk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PublicMapLinksTest {
    @Test
    fun buildsAssignmentSearchUrls() {
        assertEquals(
            "https://www.google.com/maps/search/?api=1&query=202%20area%20code%2C%20United%20States",
            PublicMapLinks.search(MapProvider.GOOGLE, "202 area code, United States"),
        )
        assertEquals(
            "https://www.bing.com/maps?q=France",
            PublicMapLinks.search(MapProvider.BING, "France"),
        )
    }

    @Test
    fun buildsPointToPointRouteUrls() {
        assertEquals(
            "https://www.google.com/maps/dir/?api=1&origin=Washington%2C%20DC&destination=Baltimore%2C%20MD&travelmode=transit",
            PublicMapLinks.directions(
                MapProvider.GOOGLE,
                "Washington, DC",
                "Baltimore, MD",
                TravelMode.TRANSIT,
            ),
        )
        assertEquals(
            "https://www.bing.com/maps?rtp=adr.Washington%2C%20DC~adr.Baltimore%2C%20MD&mode=W",
            PublicMapLinks.directions(
                MapProvider.BING,
                "Washington, DC",
                "Baltimore, MD",
                TravelMode.WALKING,
            ),
        )
    }

    @Test
    fun requiresRouteDestination() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            PublicMapLinks.directions(MapProvider.GOOGLE, "Washington, DC", " ", TravelMode.DRIVING)
        }

        assertEquals("Point B is required.", error.message)
    }
}
