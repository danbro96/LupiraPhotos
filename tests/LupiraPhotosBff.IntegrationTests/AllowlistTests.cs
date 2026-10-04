using System.Net;
using System.Net.Http.Headers;
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

    [Fact]
    public async Task Depz_without_the_probe_key_is_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/depz")).StatusCode);
    }

    private HttpClient Client() => factory.CreateClient(new() { AllowAutoRedirect = false });
}
