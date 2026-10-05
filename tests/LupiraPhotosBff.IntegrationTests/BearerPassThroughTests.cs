using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace LupiraPhotosBff.IntegrationTests;

/// <summary>The two front doors of the member proxy: a caller-presented bearer authenticates and is forwarded
/// verbatim to every upstream; anonymous API calls get status codes (never Authentik redirects) on every
/// proxied prefix; garbage bearers are rejected at the BFF.</summary>
public class BearerPassThroughTests(BffTestFactory factory) : IClassFixture<BffTestFactory>
{
    private readonly BffTestFactory _factory = factory;

    private HttpClient Client()
    {
        var c = _factory.CreateClient(new() { AllowAutoRedirect = false });
        return c;
    }

    [Theory]
    [InlineData("/api/items", "/items")]
    [InlineData("/photo-api/photos", "/photos")]
    public async Task Valid_bearer_is_accepted_and_forwarded_verbatim(string path, string upstreamPath)
    {
        var client = Client();
        var token = BffTestFactory.MintToken();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var echo = (await resp.Content.ReadFromJsonAsync<UpstreamEcho>())!;
        Assert.Equal(upstreamPath, echo.Path);
        Assert.Equal($"Bearer {token}", echo.Authorization);   // the caller's token, untouched — not a cookie exchange
        Assert.Equal("", echo.XDevUser);                       // production never sends the dev header
    }

    [Theory]
    [InlineData("GET", "/geo-api/me/places", "/me/places")]
    [InlineData("PUT", "/photo-api/photos/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11/location", "/photos/0b3f3a50-6f2f-4a8e-9a53-8f3a3f1d2c11/location")]
    public async Task Geo_and_location_calls_arrive_prefix_stripped_with_the_bearer(string method, string path, string upstreamPath)
    {
        var client = Client();
        var token = BffTestFactory.MintToken();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (method == "PUT") request.Content = JsonContent.Create(new { });

        var resp = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var echo = (await resp.Content.ReadFromJsonAsync<UpstreamEcho>())!;
        Assert.Equal(upstreamPath, echo.Path);
        Assert.Equal($"Bearer {token}", echo.Authorization);
    }

    [Theory]
    [InlineData("/api/items")]
    [InlineData("/photo-api/photos")]
    public async Task Anonymous_api_calls_get_401_not_a_redirect(string path)
    {
        var resp = await Client().GetAsync(path);
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.Null(resp.Headers.Location);
    }

    [Fact]
    public async Task Wrong_audience_bearer_is_rejected()
    {
        var client = Client();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", BffTestFactory.MintToken(audience: "someone-else"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/items")).StatusCode);
    }

    [Fact]
    public async Task Garbage_bearer_is_rejected()
    {
        var client = Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-jwt");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/items")).StatusCode);
    }

    [Fact]
    public async Task Anonymous_page_navigation_still_redirects_to_sign_in()
    {
        // The browser path is untouched: a non-API route challenge redirects toward the identity provider
        // (the static test metadata's authorize endpoint) instead of returning a bare 401.
        var resp = await Client().GetAsync("/auth/login");
        Assert.True(resp.StatusCode is HttpStatusCode.Redirect or HttpStatusCode.Found,
            $"expected a redirect, got {(int)resp.StatusCode}");
    }
}
