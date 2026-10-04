using System.Text.RegularExpressions;
using Lupira.Bff.Proxy;
using Xunit;

namespace LupiraPhotosBff.UnitTests;

public class ProxyRoutesTests
{
    private static readonly IReadOnlyList<ProxyRoute> Routes =
        ProxyRoutes.Plan(ExposedSurface.Load(typeof(Program).Assembly));

    [Fact]
    public void Every_route_carries_the_member_session()
    {
        Assert.NotEmpty(Routes);
        Assert.All(Routes, route =>
        {
            Assert.Equal("Default", route.Group.Policy);
            Assert.Equal(UpstreamCredential.Session, route.Group.Credential);
            Assert.False(route.Group.CatchAll);
        });
    }

    [Fact]
    public void Nothing_routes_a_surface_that_uses_a_different_credential()
    {
        var forbidden = new Regex(@"^/[a-z-]+/(pingz|ingest|shared|shares|users)(/|$)");

        Assert.DoesNotContain(Routes, r => forbidden.IsMatch(r.Path));
    }
}
