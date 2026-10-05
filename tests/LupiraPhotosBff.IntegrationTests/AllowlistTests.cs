using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace LupiraPhotosBff.IntegrationTests;

public class AllowlistTests(BffTestFactory factory) : IClassFixture<BffTestFactory>
{
    [Theory]
    [InlineData("/api/mcp")]
    [InlineData("/api/internal/items")]
    [InlineData("/api/calendars")]
    [InlineData("/api/items/abc/relations")]
    [InlineData("/photo-api/me")]
    [InlineData("/photo-api/openapi/v1.json")]
    public async Task Unlisted_path_under_a_proxied_prefix_is_404(string path)
    {
        var client = Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BffTestFactory.MintToken());

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
    }

    [Theory]
    [InlineData("/photo-api/photos/albums", "/photos/albums")]
    [InlineData("/photo-api/photos/density", "/photos/density")]
    [InlineData("/api/items/thin", "/items/thin")]
    public async Task Unlisted_sibling_of_a_templated_route_is_404_and_never_forwarded(string path, string upstreamPath)
    {
        var client = Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BffTestFactory.MintToken());

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
        Assert.DoesNotContain(upstreamPath, factory.Upstream.ReceivedPaths);
    }

    [Theory]
    [InlineData("GET", "/geo-api/places/suggest?q=ab", "/places/suggest")]
    [InlineData("GET", "/geo-api/geocode/forward?q=ab", "/geocode/forward")]
    [InlineData("GET", "/geo-api/places/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11", "/places/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11")]
    [InlineData("POST", "/geo-api/places/lookup", "/places/lookup")]
    [InlineData("GET", "/geo-api/me/places", "/me/places")]
    [InlineData("PUT", "/photo-api/photos/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11/location", "/photos/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11/location")]
    [InlineData("DELETE", "/photo-api/photos/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11/location", "/photos/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11/location")]
    [InlineData("POST", "/photo-api/photos/relocate", "/photos/relocate")]
    public async Task Exposed_geo_and_location_operations_reach_the_upstream(string method, string path, string upstreamPath)
    {
        var client = Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BffTestFactory.MintToken());

        var resp = await client.SendAsync(Request(method, path));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal(upstreamPath, (await resp.Content.ReadFromJsonAsync<UpstreamEcho>())!.Path);
    }

    [Theory]
    [InlineData("POST", "/geo-api/places", "/places")]
    [InlineData("DELETE", "/geo-api/me/places/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11", "/me/places/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11")]
    [InlineData("GET", "/geo-api/admin-areas", "/admin-areas")]
    [InlineData("POST", "/geo-api/places/from-geocode", "/places/from-geocode")]
    [InlineData("GET", "/geo-api/places/duplicates", "/places/duplicates")]
    [InlineData("POST", "/photo-api/photos/gps-sweep", "/photos/gps-sweep")]
    [InlineData("GET", "/photo-api/photos/density", "/photos/density")]
    public async Task Unexposed_geo_and_photo_operations_are_404_and_never_forwarded(string method, string path, string upstreamPath)
    {
        var client = Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BffTestFactory.MintToken());

        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(Request(method, path))).StatusCode);
        Assert.DoesNotContain(upstreamPath, factory.Upstream.ReceivedPaths);
    }

    [Fact]
    public async Task Depz_without_the_probe_key_is_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/depz")).StatusCode);
    }

    private static HttpRequestMessage Request(string method, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (method != "GET" && method != "DELETE")
            request.Content = JsonContent.Create(new { });
        return request;
    }

    private HttpClient Client() => factory.CreateClient(new() { AllowAutoRedirect = false });
}
