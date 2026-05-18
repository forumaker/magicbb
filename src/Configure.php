<?php

namespace forumaker\MagicBB;

use Flarum\Settings\SettingsRepositoryInterface;
use s9e\TextFormatter\Configurator;

class Configure
{
    protected SettingsRepositoryInterface $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function __invoke(Configurator $config): void
    {
        $s = fn(string $key): bool => (bool) intval($this->settings->get('forumaker-magicbb.' . $key, '1'));

        if ($s('bb_iframe')) {
            $this->enableRawIframe($config);
            $this->addIframeBBCode($config);
        }

        if ($s('bb_audio')) {
            $this->enableRawAudio($config);
            $this->addAudioBBCode($config);
        }

        $this->enableRawVideo($config);
        $this->addVideoBBCode($config);

        if ($s('bb_info')) {
            $this->addAlert($config, 'info');
            $this->addAlert($config, 'success');
            $this->addAlert($config, 'warning');
            $this->addAlert($config, 'error');
        }

        if ($s('bb_spoiler')) {
            $this->addSpoiler($config);
        }

        if ($s('bb_image')) {
            $this->addImageBBCodes($config);
        }

        $this->addDetails($config);

        $config->BBCodes->addCustom('[hr]', '<hr class="bb-hr" />');
        $config->BBCodes->addFromRepository('SUB');
        $config->BBCodes->addFromRepository('SUP');
        $config->BBCodes->addCustom(
            '[abbr={TEXT1}]{TEXT2}[/abbr]',
            '<abbr title="{TEXT1}"><xsl:apply-templates/></abbr>'
        );

        if ($s('bb_table')) {
            $config->BBCodes->addCustom('[table]{TEXT}[/table]', '<table class="bb-table"><xsl:apply-templates/></table>');
            $config->BBCodes->addCustom('[thead]{TEXT}[/thead]', '<thead><xsl:apply-templates/></thead>');
            $config->BBCodes->addCustom('[tbody]{TEXT}[/tbody]', '<tbody><xsl:apply-templates/></tbody>');
            $config->BBCodes->addCustom('[tr]{TEXT}[/tr]', '<tr><xsl:apply-templates/></tr>');
            $config->BBCodes->addCustom('[th]{TEXT}[/th]', '<th><xsl:apply-templates/></th>');
            $config->BBCodes->addCustom('[td]{TEXT}[/td]', '<td><xsl:apply-templates/></td>');
            $config->plugins->load('PipeTables');
        }

        if ($s('bb_justify')) {
            $config->BBCodes->addCustom('[justify]{TEXT}[/justify]', '<div class="bb-justify"><xsl:apply-templates/></div>');
            $config->BBCodes->addCustom('[left]{TEXT}[/left]', '<div class="bb-left"><xsl:apply-templates/></div>');
            $config->BBCodes->addCustom('[right]{TEXT}[/right]', '<div class="bb-right"><xsl:apply-templates/></div>');
        }

        if ($s('bb_hide_login')) {
            $config->BBCodes->addCustom('[login]{TEXT}[/login]', '<div class="bb-hide bb-hide--login"><xsl:apply-templates/></div>');
        }
        if ($s('bb_hide_like')) {
            $config->BBCodes->addCustom('[like]{TEXT}[/like]',   '<div class="bb-hide bb-hide--like"><xsl:apply-templates/></div>');
        }
        if ($s('bb_hide_reply')) {
            $config->BBCodes->addCustom('[reply]{TEXT}[/reply]', '<div class="bb-hide bb-hide--reply"><xsl:apply-templates/></div>');
        }

        if ($s('bb_anchor')) {
            $this->addAnchorBBCodes($config);
        }
    }

    protected function enableRawIframe(Configurator $config): void
    {
        $config->HTMLElements->allowUnsafeElement('iframe');
        $config->HTMLElements->allowAttribute('iframe', 'src');

        foreach ([
            'align', 'allow', 'allowpaymentrequest', 'class', 'credentialless', 'csp',
            'frameborder', 'height', 'id', 'loading', 'longdesc', 'marginheight',
            'marginwidth', 'name', 'referrerpolicy', 'sandbox', 'scrolling',
            'style', 'title', 'width',
        ] as $attr) {
            $config->HTMLElements->allowUnsafeAttribute('iframe', $attr);
        }
    }

    protected function enableRawAudio(Configurator $config): void
    {
        $config->HTMLElements->allowElement('audio');

        foreach (['src', 'controls', 'preload', 'class'] as $attr) {
            $config->HTMLElements->allowAttribute('audio', $attr);
        }
    }

    protected function enableRawVideo(Configurator $config): void
    {
        $config->HTMLElements->allowElement('video');

        foreach (['src', 'controls', 'preload', 'class', 'width', 'height'] as $attr) {
            $config->HTMLElements->allowAttribute('video', $attr);
        }
    }

    protected function addSpoiler(Configurator $config): void
    {
        $config->BBCodes->addCustom(
            '[spoiler title={TEXT;optional} img={URL;optional}]{TEXT}[/spoiler]',
            '<details class="bb-spoiler">
                <xsl:if test="@title or @img">
                    <summary>
                        <xsl:attribute name="class">
                            bb-spoiler__title<xsl:if test="@img"> bb-spoiler__title--image</xsl:if>
                        </xsl:attribute>
                        <xsl:if test="@img">
                            <img class="bb-spoiler__titleImg" src="{@img}" alt=""/>
                        </xsl:if>
                        <xsl:if test="@title">
                            <span class="bb-spoiler__titleText"><xsl:value-of select="@title"/></span>
                        </xsl:if>
                    </summary>
                </xsl:if>
                <div class="bb-spoiler__body"><xsl:apply-templates/></div>
            </details>'
        );
    }

    protected function addAlert(Configurator $config, string $name): void
    {
        $config->BBCodes->addCustom(
            '[' . $name . ' title={TEXT;optional} font={COLOR;optional} bg={COLOR;optional} border={COLOR;optional}]{TEXT}[/' . $name . ']',
            '<div class="bb-alert bb-alert--' . $name . '">
                <xsl:attribute name="style">
                    <xsl:if test="@bg">background: <xsl:value-of select="@bg"/>;</xsl:if>
                    <xsl:if test="@border">border-color: <xsl:value-of select="@border"/>;</xsl:if>
                    <xsl:if test="@font">color: <xsl:value-of select="@font"/>;</xsl:if>
                </xsl:attribute>
                <xsl:if test="@title">
                    <div class="bb-alert__head">
                        <span class="bb-alert__icon"></span>
                        <span class="bb-alert__title"><xsl:value-of select="@title"/></span>
                    </div>
                </xsl:if>
                <div class="bb-alert__body"><xsl:apply-templates/></div>
            </div>'
        );
    }

    protected function addImageBBCodes(Configurator $config): void
    {
        $config->BBCodes->addCustom('[ileft]{TEXT}[/ileft]', '<div class="bb-media bb-media--left"><xsl:apply-templates/></div>');
        $config->BBCodes->addCustom('[icenter]{TEXT}[/icenter]', '<div class="bb-media bb-media--center"><xsl:apply-templates/></div>');
        $config->BBCodes->addCustom('[iright]{TEXT}[/iright]', '<div class="bb-media bb-media--right"><xsl:apply-templates/></div>');
    }

    protected function addAudioBBCode(Configurator $config): void
    {
        $bb = $config->BBCodes->addCustom(
            '[audio src={URL}]{TEXT?}[/audio]',
            '<audio class="bb-audio" controls="" preload="metadata">
                <xsl:attribute name="src">
                    <xsl:value-of select="@src"/>
                </xsl:attribute>
            </audio>'
        );

        $bb->contentAttribute = 'src';
    }

    protected function addVideoBBCode(Configurator $config): void
    {
        $bb = $config->BBCodes->addCustom(
            '[video src={URL}]{TEXT?}[/video]',
            '<video class="bb-video" controls="" preload="metadata">
                <xsl:attribute name="src">
                    <xsl:value-of select="@src"/>
                </xsl:attribute>
            </video>'
        );

        $bb->contentAttribute = 'src';
    }

    protected function addIframeBBCode(Configurator $config): void
    {
        $bb = $config->BBCodes->addCustom(
            '[iframe src={URL} width={NUMBER?} height={NUMBER?}]{TEXT?}[/iframe]',
            '<iframe frameborder="0" allowfullscreen="" loading="lazy">
                <xsl:attribute name="src"><xsl:value-of select="@src"/></xsl:attribute>
                <xsl:if test="@width"><xsl:attribute name="width"><xsl:value-of select="@width"/></xsl:attribute></xsl:if>
                <xsl:if test="@height"><xsl:attribute name="height"><xsl:value-of select="@height"/></xsl:attribute></xsl:if>
                <xsl:apply-templates/>
            </iframe>'
        );

        $bb->contentAttribute = 'src';
    }

    protected function addDetails(Configurator $config): void
    {
        $config->BBCodes->addCustom(
            '[details={TEXT;optional}]{TEXT}[/details]',
            '<details class="bb-details">
                <xsl:if test="@details">
                    <summary class="bb-details__summary"><xsl:value-of select="@details"/></summary>
                </xsl:if>
                <div class="bb-details__body"><xsl:apply-templates/></div>
            </details>'
        );
    }

    protected function addAnchorBBCodes(Configurator $config): void
    {
        // Register our span template under a unique tag name.
        // MediaEmbed (anchor.fm) will overwrite the ANCHOR BBCode later, but our
        // MAGICBB_ANCHOR tag+template persists. The FixAnchorCollision render callback
        // then rewrites <ANCHOR> XML nodes that came from our BBCode to <MAGICBB_ANCHOR>.
        $config->BBCodes->addCustom(
            '[anchor={SIMPLETEXT}]',
            '<span class="bb-anchor"><xsl:attribute name="id">magicbb-<xsl:value-of select="@anchor"/></xsl:attribute></span>',
            ['tagName' => 'MAGICBB_ANCHOR']
        );

        $config->BBCodes->addCustom(
            '[jump={SIMPLETEXT}]{TEXT}[/jump]',
            '<a class="bb-jump"><xsl:attribute name="href">#magicbb-<xsl:value-of select="@jump"/></xsl:attribute><xsl:apply-templates/></a>'
        );
    }
}